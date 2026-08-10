// ============================================================
// SIGMAFLOW — МОДУЛЬ ИНВЕСТИЦИОННОГО АНАЛИЗА ПРОЕКТОВ v3.0
// ============================================================

function Project(config) {
    this.name = config.name || 'Новый проект';
    this.type = config.type || 'equipment';
    this.horizon = config.horizon || 36;
    this.startMonth = config.startMonth || 0;

    // Инвестиции — массив траншей: [{month, amount, type, usefulLife, salvageValue, includesNDS}]
    this.investments = config.investments || [];

    // Доходы: [{name, month, baseAmount, rampUpMonths}]
    this.revenues = config.revenues || [];

    // Расходы: [{name, month, baseAmount, type, rampUpMonths}]
    this.costs = config.costs || [];
    this.costsStartMonth = config.costsStartMonth || 0;

    // Финансирование
    this.financing = config.financing || { ownFunds: 0 };
    // credit: { amount, rate, term, startMonth, type: 'annuity'|'differential'|'deferred', deferredMonths }

    // Налоги
    this.taxRate = config.taxRate || 0.25;
    this.ndsRate = config.ndsRate || 0.22;
    this.insuranceRate = config.insuranceRate || 0.30;
    this.propertyTaxRate = config.propertyTaxRate || 0;

    // Амортизация
    this.amortizationType = config.amortizationType || 'linear'; // 'linear'|'accelerated'
    this.amortizationPremium = config.amortizationPremium || 0;

    // Дисконтирование по периодам: [{months: 12, rate: 0.21}, {months: 12, rate: 0.18}, ...]
    this.discountSchedule = config.discountSchedule || [{ months: 999, rate: config.discountRate || 0.21 }];
    this.reinvestmentRate = config.reinvestmentRate || 0.15;

    // Инфляция по годам: [0.07, 0.06, 0.05]
    this.inflationRates = config.inflationRates || [0.07, 0.07, 0.07];

    // Сезонность
    this.season = config.season || [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

    this.calculate();
}

Project.prototype.calculate = function () {
    var self = this;
    var h = self.horizon;

    self._initArrays(h);
    self._applyInvestments();
    self._applyDepreciation();
    self._applyAmortizationPremium();
    self._applyRevenues();
    self._applyCosts();
    self._applyCredit();
    self._applyTaxes();
    self._applyNDS();
    self._calculateOperatingFlow();
    self._calculateFinancedFlow();
    self._applyInflation();
    self._calculateDiscounted();
    self._calculateMetrics();
    self._calculateMIRR();
    self._calculateBreakeven();
    self._validateFinancing();
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
Project.prototype._initArrays = function (h) {
    var self = this;
    var arrs = ['investmentFlow', 'revenueFlow', 'costFlow', 'depreciationFlow',
        'creditFlow', 'creditRepayment', 'interestFlow', 'taxFlow', 'ndsFlow',
        'operatingFlow', 'financedFlow', 'netFlow', 'cumulativeFlow',
        'cumOperating', 'cumFinanced',
        'realOperating', 'realFinanced', 'discOperating', 'discFinanced',
        'cumDiscOperating', 'cumDiscFinanced', 'cumulativeDiscounted', 'discountedFlow'];
    arrs.forEach(function (a) { self[a] = new Array(h).fill(0); });
};

// ==================== ИНВЕСТИЦИИ ====================
Project.prototype._applyInvestments = function () {
    var self = this;
    self.totalInvestment = 0;
    self.investments.forEach(function (inv) {
        var m = inv.month || 0;
        var amt = inv.amount || 0;
        if (m < self.horizon) {
            self.investmentFlow[m] += amt;
        }
        self.totalInvestment += amt;
    });
};

// ==================== АМОРТИЗАЦИЯ ====================
Project.prototype._applyDepreciation = function () {
    var self = this;
    self.investments.forEach(function (inv) {
        if (inv.type === 'capex' && inv.usefulLife && inv.usefulLife > 0) {
            var cost = inv.amount || 0;
            var life = inv.usefulLife;
            var startM = (inv.month || 0) + 1; // амортизация со следующего месяца

            if (self.amortizationType === 'accelerated') {
                // Ускоренная: первые 2 года ×2, потом остаток
                var doubleRateMonths = Math.min(24, life);
                var doubleMonthly = (cost / life) * 2;
                var remaining = cost - doubleMonthly * doubleRateMonths;
                var normalMonthly = remaining / (life - doubleRateMonths);
                for (var m = startM; m < Math.min(startM + doubleRateMonths, self.horizon); m++) {
                    self.depreciationFlow[m] += doubleMonthly;
                }
                for (var m = startM + doubleRateMonths; m < Math.min(startM + life, self.horizon); m++) {
                    self.depreciationFlow[m] += normalMonthly;
                }
            } else {
                var monthly = cost / life;
                for (var m = startM; m < Math.min(startM + life, self.horizon); m++) {
                    self.depreciationFlow[m] += monthly;
                }
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
                self.depreciationFlow[premiumMonth] += inv.amount * self.amortizationPremium;
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
            self.revenueFlow[m] += base * coef * (self.season[mo] || 1);
        }
    });
};

// ==================== РАСХОДЫ ====================
Project.prototype._applyCosts = function () {
    var self = this;
    self.costs.forEach(function (cost) {
        var startM = Math.max(cost.month || 0, self.costsStartMonth);
        var base = cost.baseAmount || 0;
        var ramp = cost.rampUpMonths || 0;
        for (var m = startM; m < self.horizon; m++) {
            var coef = 1;
            if (ramp > 0 && cost.type === 'variable') {
                coef = Math.min(1, (m - startM) / ramp);
            }
            self.costFlow[m] += base * coef;
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
        self.creditFlow[startM] = amount;
    }

    var remaining = amount;
    var paymentStart = startM + 1 + defMonths;

    if (type === 'deferred' && defMonths > 0) {
        // Проценты в период отсрочки
        for (var m = startM + 1; m < paymentStart && m < self.horizon; m++) {
            self.interestFlow[m] += amount * monthlyRate;
        }
    }

    if (type === 'differential') {
        var bodyPayment = amount / term;
        for (var m = paymentStart; m < Math.min(paymentStart + term, self.horizon); m++) {
            var int = remaining * monthlyRate;
            self.interestFlow[m] += int;
            self.creditRepayment[m] += bodyPayment;
            remaining -= bodyPayment;
        }
    } else {
        // Аннуитет
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
            self.interestFlow[m] += int2;
            self.creditRepayment[m] += body;
            remaining -= body;
        }
    }
};

// ==================== НАЛОГИ ====================
Project.prototype._applyTaxes = function () {
    var self = this;
    var cumTaxable = 0;
    for (var m = 0; m < self.horizon; m++) {
        var income = self.revenueFlow[m] - self.costFlow[m] - self.interestFlow[m] - self.depreciationFlow[m];
        cumTaxable += income;
        if (cumTaxable > 0 && (m + 1) % 3 === 0) {
            self.taxFlow[m] = cumTaxable * self.taxRate;
            cumTaxable = 0;
        }
    }
    if (cumTaxable > 0) {
        self.taxFlow[self.horizon - 1] += cumTaxable * self.taxRate;
    }
};

// ==================== НДС ====================
Project.prototype._applyNDS = function () {
    var self = this;
    for (var m = 0; m < self.horizon; m++) {
        var outputNDS = self.revenueFlow[m] * self.ndsRate;
        var inputNDS = 0;
        // НДС с расходов
        self.costs.forEach(function (c) {
            if (c.includesNDS && c.month <= m) {
                inputNDS += (c.baseAmount || 0) * self.ndsRate;
            }
        });
        // НДС с инвестиций
        self.investments.forEach(function (inv) {
            if (inv.includesNDS && inv.month === m) {
                inputNDS += (inv.amount || 0) * self.ndsRate;
            }
        });
        self.ndsFlow[m] = outputNDS - inputNDS;
    }
};

// ==================== ПОТОКИ ====================
Project.prototype._calculateOperatingFlow = function () {
    var self = this;
    var cum = 0;
    for (var m = 0; m < self.horizon; m++) {
        self.operatingFlow[m] = self.revenueFlow[m] - self.costFlow[m] - self.investmentFlow[m]
            - self.taxFlow[m] - self.ndsFlow[m];
        // Продажа старого оборудования
        self.investments.forEach(function (inv) {
            if (inv.type === 'old_sale' && inv.month === m) {
                self.operatingFlow[m] += inv.amount || 0;
            }
        });
        // Ликвидационная стоимость в конце
        if (m === self.horizon - 1) {
            self.investments.forEach(function (inv) {
                if (inv.salvageValue) {
                    self.operatingFlow[m] += inv.salvageValue;
                }
            });
        }
        cum += self.operatingFlow[m];
        self.cumOperating[m] = cum;
    }
    self.netFlow = self.operatingFlow;
    self.cumulativeFlow = self.cumOperating;
};

Project.prototype._calculateFinancedFlow = function () {
    var self = this;
    var cum = 0;
    for (var m = 0; m < self.horizon; m++) {
        self.financedFlow[m] = self.operatingFlow[m] + self.creditFlow[m]
            - self.creditRepayment[m] - self.interestFlow[m];
        cum += self.financedFlow[m];
        self.cumFinanced[m] = cum;
    }
};

// ==================== ИНФЛЯЦИЯ ====================
Project.prototype._applyInflation = function () {
    var self = this;
    for (var m = 0; m < self.horizon; m++) {
        var yearIdx = Math.floor(m / 12);
        var infRate = self.inflationRates[Math.min(yearIdx, self.inflationRates.length - 1)] || 0.07;
        var monthlyInf = Math.pow(1 + infRate, 1 / 12) - 1;
        self.realOperating[m] = self.operatingFlow[m] / Math.pow(1 + monthlyInf, m);
        self.realFinanced[m] = self.financedFlow[m] / Math.pow(1 + monthlyInf, m);
    }
};

// ==================== ДИСКОНТИРОВАНИЕ ====================
Project.prototype._calculateDiscounted = function () {
    var self = this;
    var cumOp = 0, cumFin = 0;
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
        self.discOperating[m] = self.operatingFlow[m] / Math.pow(1 + monthlyR, m);
        self.discFinanced[m] = self.financedFlow[m] / Math.pow(1 + monthlyR, m);
        cumOp += self.discOperating[m];
        cumFin += self.discFinanced[m];
        self.cumDiscOperating[m] = cumOp;
        self.cumDiscFinanced[m] = cumFin;
    }
};

// ==================== МЕТРИКИ ====================
Project.prototype._calculateMetrics = function () {
    var self = this;

    // Операционный NPV
    self.operatingNPV = self.cumDiscOperating[self.horizon - 1];

    // NPV с финансированием
    self.financedNPV = self.cumDiscFinanced[self.horizon - 1];

    // NPV (для обратной совместимости)
    self.npv = self.financedNPV;

    // Операционный IRR
    self.operatingIRR = self._calculateIRR(self.operatingFlow);

    // Срок окупаемости (операционный)
    self.paybackPeriod = -1;
    for (var m = 0; m < self.horizon; m++) {
        if (self.cumOperating[m] >= 0) { self.paybackPeriod = m; break; }
    }

    // Дисконтированный срок окупаемости
    self.discPayback = -1;
    for (var m = 0; m < self.horizon; m++) {
        if (self.cumDiscOperating[m] >= 0) { self.discPayback = m; break; }
    }

    // ROI
    var totalNetOp = self.operatingFlow.reduce(function (s, v) { return s + v; }, 0);
    self.roi = self.totalInvestment > 0 ? (totalNetOp / self.totalInvestment * 100) : 0;

    // PI
    self.pi = self.totalInvestment > 0 ? (self.operatingNPV + self.totalInvestment) / self.totalInvestment : 0;

    // DSCR
    if (self.financing.credit && self.financing.credit.amount > 0) {
        var totalDebt = 0, totalOper = 0;
        for (var m = 0; m < self.horizon; m++) {
            totalDebt += self.creditRepayment[m] + self.interestFlow[m];
            totalOper += self.revenueFlow[m] - self.costFlow[m] - self.taxFlow[m];
        }
        self.dscr = totalDebt > 0 ? totalOper / totalDebt : 0;
    } else {
        self.dscr = null;
    }

    self.maxCashGap = Math.min.apply(null, self.cumFinanced);
    self.maxGapMonth = self.cumFinanced.indexOf(self.maxCashGap);

    // WACC (упрощённо — первая ставка дисконтирования)
    self.wacc = self.discountSchedule[0].rate;
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
    var flows = self.operatingFlow;
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
    var totalRev = self.revenueFlow.reduce(function (s, v) { return s + v; }, 0);
    if (totalRev <= 0) { self.breakevenFactor = -1; return; }
    var lo = 0, hi = 5;
    var npvAtScale = function (sc) {
        var oRev = self.revenueFlow.slice();
        var oCost = self.costFlow.slice();
        for (var i = 0; i < self.horizon; i++) { self.revenueFlow[i] *= sc; self.costFlow[i] = self.costFlow[i] * 0.7 * sc + self.costFlow[i] * 0.3; }
        self._calculateOperatingFlow();
        self._calculateDiscounted();
        var n = self.cumDiscOperating[self.horizon - 1];
        self.revenueFlow = oRev; self.costFlow = oCost;
        self._calculateOperatingFlow();
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

// ==================== ВАЛИДАЦИЯ ФИНАНСИРОВАНИЯ ====================
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
    for (var t = 0; t < this.horizon; t++) s += this.operatingFlow[t] / Math.pow(1 + mr, t);
    return s;
};
