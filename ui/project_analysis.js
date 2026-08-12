// ============================================================
// SIGMAFLOW — МОДУЛЬ ИНВЕСТИЦИОННОГО АНАЛИЗА ПРОЕКТОВ v5.0
// ============================================================

function Project(config) {
    this.name = config.name || 'Новый проект';
    this.type = config.type || 'equipment';
    this.horizon = config.horizon || 36;
    this.investments = config.investments || [];
    this.revenues = config.revenues || [];
    this.costs = config.costs || [];
    this.preprodCosts = config.preprodCosts || 0;
    this.costsStartMonth = config.costsStartMonth !== undefined ? config.costsStartMonth : 0;
    this.financing = config.financing || { ownFunds: 0 };
    this.taxRate = config.taxRate || 0.25;
    this.ndsRate = config.ndsRate || 0.22;
    this.discountSchedule = config.discountSchedule || [{ months: 999, rate: 0.21 }];
    this.reinvestmentRate = config.reinvestmentRate || 0.15;
    this.inflationRates = config.inflationRates || [0.07, 0.07, 0.07];
    this.amortizationType = config.amortizationType || 'linear';
    this.amortizationPremium = config.amortizationPremium || 0;
    this.season = config.season || [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    this.calculate();
}

Project.prototype.calculate = function () {
    var self = this;
    var h = self.horizon;
    self._initArrays(h);
    self._applyInvestments();
    self._applyDepreciation();
    self._applyRevenues();
    self._applyCosts();
    self._applyCredit();
    self._applyTaxes();
    self._applyNDS();
    self._calculateOperatingFlow();
    self._calculateFinancedFlow();
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
        'operatingFlow', 'financedFlow', 'cumOperating', 'cumFinanced',
        'discOperating', 'discFinanced', 'cumDiscOperating', 'cumDiscFinanced'];
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
        self.totalInvestment += Math.abs(amt);
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
                self.depreciationFlow[m] += monthly;
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
    if (self.preprodCosts > 0) {
        self.costFlow[0] += self.preprodCosts;
    }
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
        var inputNDS = (self.costFlow[m] + Math.abs(self.investmentFlow[m])) * self.ndsRate * 0.5;
        self.ndsFlow[m] = outputNDS - inputNDS;
    }
};

// ==================== ОПЕРАЦИОННЫЙ ПОТОК ====================
Project.prototype._calculateOperatingFlow = function () {
    var self = this;
    var cum = 0;
    for (var m = 0; m < self.horizon; m++) {
        self.operatingFlow[m] = self.revenueFlow[m] - self.costFlow[m] - self.investmentFlow[m]
            - self.taxFlow[m] - self.ndsFlow[m];
        self.investments.forEach(function (inv) {
            if (inv.type === 'old_sale' && inv.month === m) {
                self.operatingFlow[m] += Math.abs(inv.amount || 0);
            }
        });
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
};

// ==================== ФИНАНСОВЫЙ ПОТОК ====================
Project.prototype._calculateFinancedFlow = function () {
    var self = this;
    var cum = 0;
    var ownMonth = self.financing.ownMonth || 0;
    for (var m = 0; m < self.horizon; m++) {
        var ownInflow = (self.financing.ownFunds > 0 && m === ownMonth) ? self.financing.ownFunds : 0;
        self.financedFlow[m] = self.operatingFlow[m] + self.creditFlow[m] + ownInflow
            - self.creditRepayment[m] - self.interestFlow[m];
        cum += self.financedFlow[m];
        self.cumFinanced[m] = cum;
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
    self.operatingNPV = self.cumDiscOperating[self.horizon - 1];
    self.financedNPV = self.cumDiscFinanced[self.horizon - 1];
    self.npv = self.financedNPV;
    self.operatingIRR = self._calculateIRR(self.operatingFlow);
    self.paybackPeriod = -1;
    for (var m = 0; m < self.horizon; m++) {
        if (self.cumOperating[m] >= 0) { self.paybackPeriod = m; break; }
    }
    self.discPayback = -1;
    for (var m = 0; m < self.horizon; m++) {
        if (self.cumDiscOperating[m] >= 0) { self.discPayback = m; break; }
    }
    var totalNetOp = self.operatingFlow.reduce(function (s, v) { return s + v; }, 0);
    self.roi = self.totalInvestment > 0 ? (totalNetOp / self.totalInvestment * 100) : 0;
    self.pi = self.totalInvestment > 0 ? (self.operatingNPV + self.totalInvestment) / self.totalInvestment : 0;
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
        if (Math.abs(npvAt(mid)) < 1e-6) return mid;
        if (npvAt(mid) > 0) low = mid; else high = mid;
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

Project.prototype._calculateNPV_at_rate = function (rate) {
    var mr = Math.pow(1 + rate, 1 / 12) - 1;
    var s = 0;
    for (var t = 0; t < this.horizon; t++) s += this.operatingFlow[t] / Math.pow(1 + mr, t);
    return s;
};
