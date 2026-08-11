// ============================================================
// SIGMAFLOW — МОДУЛЬ ИНВЕСТИЦИОННОГО АНАЛИЗА ПРОЕКТОВ v4.0
// Стандарт UNIDO
// ============================================================

function Project(config) {
    this.name = config.name || 'Новый проект';
    this.type = config.type || 'equipment';
    this.horizon = config.horizon || 36;

    this.investments = config.investments || [];
    this.revenues = config.revenues || [];
    this.costs = config.costs || [];
    this.costsStartMonth = config.costsStartMonth !== undefined ? config.costsStartMonth : 0;
    this.preprodCosts = config.preprodCosts || 0;

    this.financing = config.financing || { ownFunds: 0 };
    this.taxRate = config.taxRate || 0.25;
    this.ndsRate = config.ndsRate || 0.22;
    this.amortizationType = config.amortizationType || 'linear';
    this.amortizationPremium = config.amortizationPremium || 0;
    this.discountSchedule = config.discountSchedule || [{ months: 999, rate: 0.21 }];
    this.reinvestmentRate = config.reinvestmentRate || 0.15;
    this.inflationRates = config.inflationRates || [0.07, 0.07, 0.07];
    this.season = config.season || [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

    this.calculate();
}

Project.prototype.calculate = function () {
    var self = this;
    var h = self.horizon;

    self._initArrays(h);
    self._applyInvestments();
    self._applyRevenues();
    self._applyCosts();
    self._applyCredit();
    self._applyDepreciation();
    self._applyAmortizationPremium();
    self._applyNDS();
    self._applyTaxes();
    self._calcThreeFlows();
    self._applyInflation();
    self._calculateDiscounted();
    self._calculateMetrics();
    self._calculateMIRR();
    self._calculateBreakeven();
    self._validateFinancing();

    // Для обратной совместимости со старым кодом
    self.netFlow = self.flows.projectFCFF;
    self.cumulativeFlow = self.flows.cumProject;
};

// ==================== ИНИЦИАЛИЗАЦИЯ МАССИВОВ ====================
Project.prototype._initArrays = function (h) {
    var self = this;
    var zeros = function () { var a = new Array(h); for (var i = 0; i < h; i++) a[i] = 0; return a; };

    self.operating = {
        revenue: zeros(),
        opex: zeros(),
        taxes: zeros(),
        vatNet: zeros(),
        flow: zeros()
    };

    self.investment = {
        capex: zeros(),
        preprod: zeros(),
        nwc: zeros(),
        salvage: zeros(),
        flow: zeros()
    };

    if (!self.financing) self.financing = {};
    self.financing.equity = zeros();
    self.financing.creditInflow = zeros();
    self.financing.creditRepayment = zeros();
    self.financing.interest = zeros();
    self.financing.flow = zeros();

    self.flows = {
        projectFCFF: zeros(),
        equityFCFE: zeros(),
        cumProject: zeros(),
        cumEquity: zeros(),
        discountedFCFF: zeros(),
        discountedFCFE: zeros(),
        cumDiscFCFF: zeros(),
        cumDiscFCFE: zeros()
    };

    self.depreciation = zeros();

    // Для совместимости
    self.revenueFlow = self.operating.revenue;
    self.costFlow = self.operating.opex;
    self.taxFlow = self.operating.taxes;
    self.ndsFlow = self.operating.vatNet;
    self.investmentFlow = self.investment.flow;
    self.interestFlow = self.financing.interest;
    self.creditRepayment = self.financing.creditRepayment;
    self.creditFlow = self.financing.creditInflow;
};

// ==================== ИНВЕСТИЦИИ ====================
Project.prototype._applyInvestments = function () {
    var self = this;
    self.totalInvestment = 0;

    // Предстартовые расходы — в investment.preprod[0]
    if (self.preprodCosts > 0) {
        self.investment.preprod[0] = self.preprodCosts;
        self.totalInvestment += self.preprodCosts;
    }

    self.investments.forEach(function (inv) {
        var m = inv.month || 0;
        var amt = inv.amount || 0;
        if (m < self.horizon) {
            if (inv.type === 'working_capital') {
                self.investment.nwc[m] += amt;
                if (inv.releaseMonth && inv.releaseMonth < self.horizon) {
                    self.investment.nwc[inv.releaseMonth] -= amt; // возврат
                } else {
                    self.investment.nwc[self.horizon - 1] -= amt; // возврат в конце
                }
                self.totalInvestment += amt;
            } else if (inv.type === 'old_sale') {
                self.investment.salvage[m] += Math.abs(amt);
            } else {
                self.investment.capex[m] += Math.abs(amt);
                self.totalInvestment += Math.abs(amt);
            }
        }
    });
};

// ==================== ВЫРУЧКА ====================
Project.prototype._applyRevenues = function () {
    var self = this;
    self.revenues.forEach(function (rev) {
        var startM = rev.month || 0;
        var base = rev.baseAmount || 0;
        var ramp = rev.rampUpMonths || 0;
        for (var m = startM; m < self.horizon; m++) {
            var coef = Math.min(1, ramp > 0 ? (m - startM) / ramp : 1);
            var mo = m % 12;
            self.operating.revenue[m] += base * coef * (self.season[mo] || 1);
        }
    });
};

// ==================== РАСХОДЫ (OPEX) ====================
Project.prototype._applyCosts = function () {
    var self = this;
    self.costs.forEach(function (cost) {
        var base = cost.baseAmount || 0;
        var startM = Math.max(cost.month || 0, self.costsStartMonth);
        var ramp = cost.rampUpMonths || 0;

        if (cost.month !== undefined && ramp === 0 && cost.type === 'fixed') {
            // Единовременная затрата (ЗИП, материалы) — только в указанном месяце
            if (startM < self.horizon) {
                self.operating.opex[startM] += base;
            }
        } else {
            // Регулярные расходы — каждый месяц начиная со startM
            for (var m = startM; m < self.horizon; m++) {
                var coef = 1;
                if (ramp > 0 && cost.type === 'variable') {
                    coef = Math.min(1, (m - startM) / ramp);
                }
                self.operating.opex[m] += base * coef;
            }
        }
    });
};

// ==================== АМОРТИЗАЦИЯ ====================
Project.prototype._applyDepreciation = function () {
    var self = this;
    self.investments.forEach(function (inv) {
        if (inv.type === 'capex' && inv.usefulLife && inv.usefulLife > 0) {
            var cost = Math.abs(inv.amount || 0);
            var life = inv.usefulLife;
            var startM = (inv.month || 0) + 1;
            var monthly = cost / life;
            for (var m = startM; m < Math.min(startM + life, self.horizon); m++) {
                self.depreciation[m] += monthly;
            }
        }
    });
};

// ==================== АМОРТИЗАЦИОННАЯ ПРЕМИЯ ====================
Project.prototype._applyAmortizationPremium = function () {
    var self = this;
    if (self.amortizationPremium <= 0) return;
    self.investments.forEach(function (inv) {
        if (inv.type === 'capex' && inv.amount) {
            var premiumMonth = (inv.month || 0) + 1;
            if (premiumMonth < self.horizon) {
                self.depreciation[premiumMonth] += Math.abs(inv.amount) * self.amortizationPremium;
            }
        }
    });
};

// ==================== КРЕДИТ ====================
Project.prototype._applyCredit = function () {
    var self = this;
    var cr = self.financing.credit;
    if (!cr || cr.amount <= 0) return;

    var amount = cr.amount;
    var rate = cr.rate || 0;
    var term = cr.term || 12;
    var startM = cr.startMonth || 0;
    var monthlyRate = rate / 12;
    var defMonths = cr.deferredMonths || 0;
    var type = cr.type || 'annuity';

    if (startM < self.horizon) {
        self.financing.creditInflow[startM] = amount;
    }

    var remaining = amount;
    var paymentStart = startM + 1 + defMonths;

    if (type === 'deferred' && defMonths > 0) {
        for (var m = startM + 1; m < paymentStart && m < self.horizon; m++) {
            self.financing.interest[m] += amount * monthlyRate;
        }
    }

    if (type === 'differential') {
        var bodyPayment = amount / term;
        for (var m = paymentStart; m < Math.min(paymentStart + term, self.horizon); m++) {
            var int = remaining * monthlyRate;
            self.financing.interest[m] += int;
            self.financing.creditRepayment[m] += bodyPayment;
            remaining -= bodyPayment;
        }
    } else {
        var activeTerm = term - defMonths;
        var annuity = 0;
        if (monthlyRate > 0 && activeTerm > 0) {
            annuity = remaining * monthlyRate * Math.pow(1 + monthlyRate, activeTerm) /
                (Math.pow(1 + monthlyRate, activeTerm) - 1);
        } else if (activeTerm > 0) {
            annuity = remaining / activeTerm;
        }
        for (var m = paymentStart; m < Math.min(paymentStart + activeTerm, self.horizon); m++) {
            var int2 = remaining * monthlyRate;
            var body = annuity - int2;
            self.financing.interest[m] += int2;
            self.financing.creditRepayment[m] += body;
            remaining -= body;
        }
    }
};

// ==================== НДС ====================
Project.prototype._applyNDS = function () {
    var self = this;
    for (var m = 0; m < self.horizon; m++) {
        var outputNDS = self.operating.revenue[m] * self.ndsRate;
        var inputNDS = self.operating.opex[m] * self.ndsRate;
        self.operating.vatNet[m] = outputNDS - inputNDS;
    }
};

// ==================== НАЛОГ НА ПРИБЫЛЬ ====================
Project.prototype._applyTaxes = function () {
    var self = this;
    var lossCarryForward = 0;
    var taxAccum = 0;
    for (var m = 0; m < self.horizon; m++) {
        var ebit = self.operating.revenue[m] - self.operating.opex[m] - self.depreciation[m] - self.financing.interest[m];
        if (ebit < 0) {
            lossCarryForward += Math.abs(ebit);
            self.operating.taxes[m] = 0;
        } else {
            var taxableIncome = ebit - lossCarryForward;
            if (taxableIncome < 0) {
                lossCarryForward = Math.abs(taxableIncome);
                taxableIncome = 0;
            } else {
                lossCarryForward = 0;
            }
            if (taxableIncome > 0) {
                taxAccum += taxableIncome;
                if ((m + 1) % 3 === 0) {
                    self.operating.taxes[m] = taxAccum * self.taxRate;
                    taxAccum = 0;
                }
            }
        }
    }
    if (taxAccum > 0) {
        self.operating.taxes[self.horizon - 1] += taxAccum * self.taxRate;
    }
};

// ==================== СВОИ СРЕДСТВА ====================
Project.prototype._applyEquity = function () {
    var self = this;
    var ownFunds = self.financing.ownFunds || 0;
    var ownMonth = self.financing.ownMonth || 0;
    if (ownFunds > 0 && ownMonth < self.horizon) {
        self.financing.equity[ownMonth] = ownFunds;
    }
};

// ==================== ТРИ ПОТОКА ====================
Project.prototype._calcThreeFlows = function () {
    var self = this;
    self._applyEquity();

    for (var m = 0; m < self.horizon; m++) {
        // Операционный поток
        self.operating.flow[m] = self.operating.revenue[m] - self.operating.opex[m]
            - self.operating.taxes[m] - self.operating.vatNet[m];

        // Инвестиционный поток
        self.investment.flow[m] = -self.investment.capex[m] - self.investment.preprod[m]
            - self.investment.nwc[m] + self.investment.salvage[m];

        // Финансовый поток
        self.financing.flow[m] = self.financing.equity[m] + self.financing.creditInflow[m]
            - self.financing.creditRepayment[m] - self.financing.interest[m];

        // Сводные
        self.flows.projectFCFF[m] = self.operating.flow[m] + self.investment.flow[m];
        self.flows.equityFCFE[m] = self.flows.projectFCFF[m] + self.financing.flow[m];

        self.flows.cumProject[m] = (m === 0) ? self.flows.projectFCFF[m] :
            self.flows.cumProject[m - 1] + self.flows.projectFCFF[m];
        self.flows.cumEquity[m] = (m === 0) ? self.flows.equityFCFE[m] :
            self.flows.cumEquity[m - 1] + self.flows.equityFCFE[m];
    }
};

// ==================== ИНФЛЯЦИЯ ====================
Project.prototype._applyInflation = function () {
    // Упрощённо — не применяем, оставляем для будущих версий
};

// ==================== ДИСКОНТИРОВАНИЕ ====================
Project.prototype._calculateDiscounted = function () {
    var self = this;
    var cumProj = 0, cumEq = 0;
    for (var m = 0; m < self.horizon; m++) {
        var monthsPassed = 0;
        var rate = self.discountSchedule[0].rate;
        for (var s = 0; s < self.discountSchedule.length; s++) {
            if (m < monthsPassed + self.discountSchedule[s].months) {
                rate = self.discountSchedule[s].rate;
                break;
            }
            monthsPassed += self.discountSchedule[s].months;
        }
        var monthlyR = Math.pow(1 + rate, 1 / 12) - 1;
        self.flows.discountedFCFF[m] = self.flows.projectFCFF[m] / Math.pow(1 + monthlyR, m);
        self.flows.discountedFCFE[m] = self.flows.equityFCFE[m] / Math.pow(1 + monthlyR, m);
        cumProj += self.flows.discountedFCFF[m];
        cumEq += self.flows.discountedFCFE[m];
        self.flows.cumDiscFCFF[m] = cumProj;
        self.flows.cumDiscFCFE[m] = cumEq;
    }
};

// ==================== МЕТРИКИ ====================
Project.prototype._calculateMetrics = function () {
    var self = this;
    var h = self.horizon;

    self.operatingNPV = self.flows.cumDiscFCFF[h - 1];
    self.financedNPV = self.flows.cumDiscFCFE[h - 1];
    self.npv = self.operatingNPV;

    self.operatingIRR = self._calculateIRR(self.flows.projectFCFF);
    self.wacc = self.discountSchedule[0].rate;

    self.paybackPeriod = -1;
    for (var m = 0; m < h; m++) {
        if (self.flows.cumProject[m] >= 0) { self.paybackPeriod = m; break; }
    }

    self.discPayback = -1;
    for (var m = 0; m < h; m++) {
        if (self.flows.cumDiscFCFF[m] >= 0) { self.discPayback = m; break; }
    }

    var totalNetOp = self.flows.projectFCFF.reduce(function (s, v) { return s + v; }, 0);
    self.roi = self.totalInvestment > 0 ? (totalNetOp / self.totalInvestment * 100) : 0;
    self.pi = self.totalInvestment > 0 ? (self.operatingNPV + self.totalInvestment) / self.totalInvestment : 0;

    if (self.financing.credit && self.financing.credit.amount > 0) {
        var totalDebt = 0, totalOper = 0;
        for (var m = 0; m < h; m++) {
            totalDebt += self.financing.creditRepayment[m] + self.financing.interest[m];
            totalOper += self.operating.revenue[m] - self.operating.opex[m] - self.operating.taxes[m];
        }
        self.dscr = totalDebt > 0 ? totalOper / totalDebt : 0;
    } else {
        self.dscr = null;
    }

    self.maxCashGap = Math.min.apply(null, self.flows.cumEquity);
    self.maxGapMonth = self.flows.cumEquity.indexOf(self.maxCashGap);
};

// ==================== IRR ====================
Project.prototype._calculateIRR = function (flows) {
    var self = this;
    var npvAt = function (r) {
        var mr = Math.pow(1 + r, 1 / 12) - 1;
        var s = 0;
        for (var t = 0; t < flows.length; t++) s += flows[t] / Math.pow(1 + mr, t);
        return s;
    };
    if (npvAt(0) <= 0) return -0.99;
    var low = 0, high = 1;
    while (npvAt(high) > 0 && high < 1000) high *= 2;
    for (var i = 0; i < 100; i++) {
        var mid = (low + high) / 2;
        var n = npvAt(mid);
        if (Math.abs(n) < 1e-6) return mid;
        if (n > 0) low = mid; else high = mid;
    }
    return (low + high) / 2;
};

// ==================== MIRR ====================
Project.prototype._calculateMIRR = function () {
    var self = this;
    var flows = self.flows.projectFCFF;
    var mr = Math.pow(1 + self.reinvestmentRate, 1 / 12) - 1;
    var dr = Math.pow(1 + self.wacc, 1 / 12) - 1;
    var fv = 0, pv = 0;
    for (var t = 0; t < flows.length; t++) {
        if (flows[t] > 0) fv += flows[t] * Math.pow(1 + mr, self.horizon - 1 - t);
        else pv += Math.abs(flows[t]) / Math.pow(1 + dr, t);
    }
    if (pv <= 0 || fv <= 0) { self.mirr = 0; return; }
    var mirrM = Math.pow(fv / pv, 1 / self.horizon) - 1;
    self.mirr = Math.pow(1 + mirrM, 12) - 1;
};

// ==================== ТОЧКА БЕЗУБЫТОЧНОСТИ ====================
Project.prototype._calculateBreakeven = function () {
    var self = this;
    var totalRev = self.operating.revenue.reduce(function (s, v) { return s + v; }, 0);
    if (totalRev <= 0) { self.breakevenFactor = -1; return; }
    var lo = 0, hi = 5;
    var npvAtScale = function (sc) {
        var oRev = self.operating.revenue.slice();
        var oOpex = self.operating.opex.slice();
        for (var i = 0; i < self.horizon; i++) {
            self.operating.revenue[i] *= sc;
            self.operating.opex[i] = self.operating.opex[i] * 0.7 * sc + self.operating.opex[i] * 0.3;
        }
        self._calcThreeFlows();
        self._calculateDiscounted();
        var n = self.flows.cumDiscFCFF[self.horizon - 1];
        self.operating.revenue = oRev;
        self.operating.opex = oOpex;
        self._calcThreeFlows();
        self._calculateDiscounted();
        return n;
    };
    for (var i = 0; i < 50; i++) {
        var mid = (lo + hi) / 2;
        if (Math.abs(npvAtScale(mid)) < 1000) { self.breakevenFactor = mid; return; }
        if (npvAtScale(mid) < 0) lo = mid; else hi = mid;
    }
    self.breakevenFactor = (lo + hi) / 2;
};

// ==================== ВАЛИДАЦИЯ ====================
Project.prototype._validateFinancing = function () {
    var self = this;
    self.financingGap = self.totalInvestment - (self.financing.ownFunds || 0);
    if (self.financing.credit && self.financing.credit.amount > 0) {
        self.creditExcess = self.financing.credit.amount - Math.max(0, self.financingGap);
    } else {
        self.creditExcess = 0;
    }
};

// Вспомогательный метод
Project.prototype._calculateNPV_at_rate = function (rate) {
    var mr = Math.pow(1 + rate, 1 / 12) - 1;
    var s = 0;
    for (var t = 0; t < this.horizon; t++) s += this.flows.projectFCFF[t] / Math.pow(1 + mr, t);
    return s;
};
