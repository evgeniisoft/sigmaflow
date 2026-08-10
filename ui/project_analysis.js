// ============================================================
// SIGMAFLOW — МОДУЛЬ ИНВЕСТИЦИОННОГО АНАЛИЗА ПРОЕКТОВ v2.0
// ============================================================

function Project(config) {
    this.name = config.name || 'Новый проект';
    this.type = config.type || 'new_product';
    this.horizon = config.horizon || 36;
    this.investments = config.investments || [];
    this.revenues = config.revenues || [];
    this.costs = config.costs || [];
    this.financing = config.financing || { ownFunds: 0 };
    this.discountRate = config.discountRate || 0.21; // ключевая ставка
    this.reinvestmentRate = config.reinvestmentRate || 0.15; // ставка реинвестирования для MIRR
    this.taxRate = config.taxRate || 0.25;
    this.ndsRate = config.ndsRate || 0.22;
    this.insuranceRate = config.insuranceRate || 0.30;
    this.inflationRate = config.inflationRate || 0.07;
    this.propertyTaxRate = config.propertyTaxRate || 0;
    this.amortizationPremium = config.amortizationPremium || 0; // амортизационная премия (0.1 = 10%)
    this.season = config.season || [1,1,1,1,1,1,1,1,1,1,1,1];
    this.scenarios = config.scenarios || null; // { optimistic: {revenueMul: 1.2, costMul: 0.9}, pessimistic: {revenueMul: 0.8, costMul: 1.1} }

    this.calculate();
}

Project.prototype.calculate = function () {
    var self = this;
    var h = self.horizon;

    // Инициализация
    self._initArrays(h);

    // === ИНВЕСТИЦИИ ===
    self._applyInvestments();

    // === АМОРТИЗАЦИЯ ===
    self._applyDepreciation();

    // === АМОРТИЗАЦИОННАЯ ПРЕМИЯ ===
    self._applyAmortizationPremium();

    // === ВЫРУЧКА ===
    self._applyRevenues();

    // === РАСХОДЫ ===
    self._applyCosts();

    // === ОБОРОТНЫЙ КАПИТАЛ ===
    self._applyWorkingCapital();

    // === КРЕДИТ ===
    self._applyCredit();

    // === НАЛОГ НА ИМУЩЕСТВО ===
    self._applyPropertyTax();

    // === НАЛОГ НА ПРИБЫЛЬ (перенос убытков, квартальная уплата) ===
    self._applyProfitTax();

    // === НДС ===
    self._applyNDS();

    // === НЕТ-ПОТОК ===
    self._calculateNetFlow();

    // === WACC ===
    self._calculateWACC();

    // === ИНФЛЯЦИЯ (перевод в реальные цены) ===
    self._applyInflation();

    // === ДИСКОНТИРОВАННЫЙ ПОТОК ===
    self._calculateDiscounted();

    // === КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ ===
    self._calculateMetrics();

    // === MIRR ===
    self._calculateMIRR();

    // === ТОЧКА БЕЗУБЫТОЧНОСТИ ПРОЕКТА ===
    self._calculateBreakeven();

    // === АНАЛИЗ СЦЕНАРИЕВ ===
    if (self.scenarios) {
        self._calculateScenarios();
    }

    // === АНАЛИЗ ЧУВСТВИТЕЛЬНОСТИ ===
    self.sensitivity = self._calculateSensitivity();
};

// ==================== ИНИЦИАЛИЗАЦИЯ МАССИВОВ ====================
Project.prototype._initArrays = function (h) {
    var self = this;
    var arrays = ['investmentFlow', 'revenueFlow', 'costFlow', 'creditFlow',
        'creditRepayment', 'interestFlow', 'depreciationFlow', 'taxFlow',
        'ndsFlow', 'propertyTaxFlow', 'workingCapitalFlow', 'netFlow',
        'cumulativeFlow', 'realNetFlow', 'discountedFlow', 'cumulativeDiscounted'];
    arrays.forEach(function (arr) {
        self[arr] = new Array(h).fill(0);
    });
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
            var monthlyDA = (inv.amount || 0) / (inv.usefulLife);
            var startM = inv.month || 0;
            var premiumMonths = self.amortizationPremium > 0 ? 1 : 0;
            var adjustedAmount = (inv.amount || 0) * (1 - self.amortizationPremium);
            monthlyDA = adjustedAmount / (inv.usefulLife);
            for (var m = startM + premiumMonths; m < Math.min(startM + (inv.usefulLife), self.horizon); m++) {
                self.depreciationFlow[m] += monthlyDA;
            }
        }
    });
};

// ==================== АМОРТИЗАЦИОННАЯ ПРЕМИЯ ====================
Project.prototype._applyAmortizationPremium = function () {
    var self = this;
    if (self.amortizationPremium <= 0) return;
    self.investments.forEach(function (inv) {
        if (inv.type === 'capex') {
            var m = (inv.month || 0) + 1;
            if (m < self.horizon) {
                self.depreciationFlow[m] += (inv.amount || 0) * self.amortizationPremium;
            }
        }
    });
};

// ==================== ВЫРУЧКА ====================
Project.prototype._applyRevenues = function () {
    var self = this;
    self.revenues.forEach(function (rev) {
        var startM = rev.month || 0;
        var baseAmount = rev.baseAmount || 0;
        var rampUp = rev.rampUpMonths || 0;
        for (var m = startM; m < self.horizon; m++) {
            var rampCoef = Math.min(1, rampUp > 0 ? (m - startM) / rampUp : 1);
            var mo = m % 12;
            var seasonCoef = self.season[mo] || 1;
            self.revenueFlow[m] += baseAmount * rampCoef * seasonCoef;
        }
    });
};

// ==================== РАСХОДЫ ====================
Project.prototype._applyCosts = function () {
    var self = this;
    self.costs.forEach(function (cost) {
        var startM = cost.month || 0;
        var baseAmount = cost.baseAmount || 0;
        var rampUp = cost.rampUpMonths || 0;
        for (var m = startM; m < self.horizon; m++) {
            var rampCoef = 1;
            if (rampUp > 0 && cost.type === 'variable') {
                rampCoef = Math.min(1, (m - startM) / rampUp);
            }
            self.costFlow[m] += baseAmount * rampCoef;
        }
    });
};

// ==================== ОБОРОТНЫЙ КАПИТАЛ ====================
Project.prototype._applyWorkingCapital = function () {
    var self = this;
    self.investments.forEach(function (inv) {
        if (inv.type === 'working_capital' && inv.amount) {
            var startM = inv.month || 0;
            var releaseM = inv.releaseMonth || (self.horizon - 1);
            if (startM < self.horizon) self.workingCapitalFlow[startM] -= inv.amount;
            if (releaseM < self.horizon) self.workingCapitalFlow[releaseM] += inv.amount;
        }
    });
};

// ==================== КРЕДИТ ====================
Project.prototype._applyCredit = function () {
    var self = this;
    if (!self.financing.credit || self.financing.credit.amount <= 0) return;
    var cr = self.financing.credit;
    var crStart = cr.startMonth || 0;
    var crAmount = cr.amount || 0;
    var crRate = cr.rate || 0;
    var crTerm = cr.term || 12;
    var monthlyRate = crRate / 12;

    if (crStart < self.horizon) {
        self.creditFlow[crStart] = crAmount;
    }

    var annuity = 0;
    if (monthlyRate > 0) {
        annuity = crAmount * monthlyRate * Math.pow(1 + monthlyRate, crTerm) / (Math.pow(1 + monthlyRate, crTerm) - 1);
    } else {
        annuity = crAmount / crTerm;
    }

    var remainingDebt = crAmount;
    for (var m = crStart + 1; m < Math.min(crStart + 1 + crTerm, self.horizon); m++) {
        var interest = remainingDebt * monthlyRate;
        var body = annuity - interest;
        self.interestFlow[m] += interest;
        self.creditRepayment[m] += body;
        remainingDebt -= body;
    }
};

// ==================== НАЛОГ НА ИМУЩЕСТВО ====================
Project.prototype._applyPropertyTax = function () {
    var self = this;
    if (self.propertyTaxRate <= 0) return;
    self.investments.forEach(function (inv) {
        if (inv.type === 'real_estate') {
            var startM = inv.month || 0;
            var residualValue = inv.amount || 0;
            for (var m = startM; m < self.horizon; m++) {
                var annualTax = residualValue * self.propertyTaxRate;
                // Уплата раз в квартал
                if ((m + 1) % 3 === 0) {
                    self.propertyTaxFlow[m] += annualTax / 4;
                }
                // Уменьшаем остаточную стоимость
                residualValue -= (inv.amount || 0) / (inv.usefulLife || 120);
                if (residualValue < 0) residualValue = 0;
            }
        }
    });
};

// ==================== НАЛОГ НА ПРИБЫЛЬ ====================
Project.prototype._applyProfitTax = function () {
    var self = this;
    var cumulativeTaxable = 0;
    for (var m = 0; m < self.horizon; m++) {
        var income = self.revenueFlow[m] - self.costFlow[m] - self.interestFlow[m]
            - self.depreciationFlow[m] - self.propertyTaxFlow[m];
        cumulativeTaxable += income;
        if (cumulativeTaxable > 0) {
            if ((m + 1) % 3 === 0) {
                self.taxFlow[m] = cumulativeTaxable * self.taxRate;
                cumulativeTaxable = 0;
            }
        }
    }
    if (cumulativeTaxable > 0) {
        self.taxFlow[self.horizon - 1] += cumulativeTaxable * self.taxRate;
    }
};

// ==================== НДС ====================
Project.prototype._applyNDS = function () {
    var self = this;
    for (var m = 0; m < self.horizon; m++) {
        var outputNDS = self.revenueFlow[m] * self.ndsRate;
        var inputNDS = (self.costFlow[m] + self.investmentFlow[m]) * self.ndsRate;
        self.ndsFlow[m] = outputNDS - inputNDS;
    }
};

// ==================== НЕТ-ПОТОК ====================
Project.prototype._calculateNetFlow = function () {
    var self = this;
    var cumCash = 0;
    for (var m = 0; m < self.horizon; m++) {
        self.netFlow[m] = self.revenueFlow[m]
            - self.costFlow[m]
            - self.investmentFlow[m]
            + self.creditFlow[m]
            - self.creditRepayment[m]
            - self.interestFlow[m]
            - self.taxFlow[m]
            - self.ndsFlow[m]
            - self.propertyTaxFlow[m]
            + self.workingCapitalFlow[m];
        // Ликвидационная стоимость в последнем периоде
        if (m === self.horizon - 1) {
            self.investments.forEach(function (inv) {
                if (inv.type === 'capex' && inv.salvageValue) {
                    self.netFlow[m] += inv.salvageValue;
                }
            });
        }
        cumCash += self.netFlow[m];
        self.cumulativeFlow[m] = cumCash;
    }
};

// ==================== WACC ====================
Project.prototype._calculateWACC = function () {
    var self = this;
    if (self.financing.credit && self.financing.credit.amount > 0 && self.financing.ownFunds > 0) {
        var totalCapital = self.financing.ownFunds + self.financing.credit.amount;
        var equityShare = self.financing.ownFunds / totalCapital;
        var debtShare = self.financing.credit.amount / totalCapital;
        var costOfEquity = self.discountRate;
        var costOfDebt = self.financing.credit.rate * (1 - self.taxRate);
        self.wacc = equityShare * costOfEquity + debtShare * costOfDebt;
        self.effectiveDiscountRate = self.wacc;
    } else {
        self.wacc = self.discountRate;
        self.effectiveDiscountRate = self.discountRate;
    }
};

// ==================== ИНФЛЯЦИЯ ====================
Project.prototype._applyInflation = function () {
    var self = this;
    var monthlyInf = Math.pow(1 + self.inflationRate, 1 / 12) - 1;
    for (var m = 0; m < self.horizon; m++) {
        self.realNetFlow[m] = self.netFlow[m] / Math.pow(1 + monthlyInf, m);
    }
};

// ==================== ДИСКОНТИРОВАННЫЙ ПОТОК ====================
Project.prototype._calculateDiscounted = function () {
    var self = this;
    var monthlyRate = Math.pow(1 + self.effectiveDiscountRate, 1 / 12) - 1;
    var cumDisc = 0;
    for (var m = 0; m < self.horizon; m++) {
        self.discountedFlow[m] = self.netFlow[m] / Math.pow(1 + monthlyRate, m);
        cumDisc += self.discountedFlow[m];
        self.cumulativeDiscounted[m] = cumDisc;
    }
};

// ==================== КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ ====================
Project.prototype._calculateMetrics = function () {
    var self = this;

    // NPV
    self.npv = self.cumulativeDiscounted[self.horizon - 1];

    // IRR (бинарный поиск)
    self.irr = self._calculateIRR();

    // Срок окупаемости (простой)
    self.paybackPeriod = -1;
    for (var m = 0; m < self.horizon; m++) {
        if (self.cumulativeFlow[m] >= 0) { self.paybackPeriod = m; break; }
    }

    // Дисконтированный срок окупаемости
    self.discountedPayback = -1;
    for (var m = 0; m < self.horizon; m++) {
        if (self.cumulativeDiscounted[m] >= 0) { self.discountedPayback = m; break; }
    }

    // ROI
    var totalNetFlow = self.netFlow.reduce(function (s, v) { return s + v; }, 0);
    self.roi = self.totalInvestment > 0 ? (totalNetFlow / self.totalInvestment * 100) : 0;

    // PI
    self.pi = self.totalInvestment > 0 ? (self.npv + self.totalInvestment) / self.totalInvestment : 0;

    // DSCR (Debt Service Coverage Ratio) — средний
    if (self.financing.credit && self.financing.credit.amount > 0) {
        var totalDebtService = 0;
        var totalOperatingIncome = 0;
        for (var m = 0; m < self.horizon; m++) {
            totalDebtService += self.creditRepayment[m] + self.interestFlow[m];
            totalOperatingIncome += self.revenueFlow[m] - self.costFlow[m] - self.taxFlow[m];
        }
        self.dscr = totalDebtService > 0 ? totalOperatingIncome / totalDebtService : 0;
    } else {
        self.dscr = null;
    }

    // Максимальный кассовый разрыв
    self.maxCashGap = Math.min.apply(null, self.cumulativeFlow);
    self.maxGapMonth = self.cumulativeFlow.indexOf(self.maxCashGap);
};

// ==================== IRR ====================
Project.prototype._calculateIRR = function () {
    var self = this;
    var npvAt = function (r) {
        var monthlyR = Math.pow(1 + r, 1 / 12) - 1;
        var sum = 0;
        for (var t = 0; t < self.horizon; t++) {
            sum += self.netFlow[t] / Math.pow(1 + monthlyR, t);
        }
        return sum;
    };

    if (npvAt(0) <= 0) return 0;
    var low = 0;
    var high = 1;
    while (npvAt(high) > 0 && high < 1000) high *= 2;
    var tol = 1e-6;
    for (var i = 0; i < 100; i++) {
        var mid = (low + high) / 2;
        var npvMid = npvAt(mid);
        if (Math.abs(npvMid) < tol) return mid;
        if (npvMid > 0) low = mid; else high = mid;
    }
    return (low + high) / 2;
};

// ==================== MIRR ====================
Project.prototype._calculateMIRR = function () {
    var self = this;
    var monthlyReinv = Math.pow(1 + self.reinvestmentRate, 1 / 12) - 1;
    var monthlyFinance = Math.pow(1 + self.effectiveDiscountRate, 1 / 12) - 1;

    var fvPositive = 0;
    var pvNegative = 0;

    for (var t = 0; t < self.horizon; t++) {
        if (self.netFlow[t] > 0) {
            fvPositive += self.netFlow[t] * Math.pow(1 + monthlyReinv, self.horizon - 1 - t);
        } else if (self.netFlow[t] < 0) {
            pvNegative += Math.abs(self.netFlow[t]) / Math.pow(1 + monthlyFinance, t);
        }
    }

    if (pvNegative <= 0 || fvPositive <= 0) {
        self.mirr = 0;
        return;
    }

    var mirrMonthly = Math.pow(fvPositive / pvNegative, 1 / self.horizon) - 1;
    self.mirr = Math.pow(1 + mirrMonthly, 12) - 1;
};

// ==================== ТОЧКА БЕЗУБЫТОЧНОСТИ ПРОЕКТА ====================
Project.prototype._calculateBreakeven = function () {
    var self = this;

    // Находим месячный объём продаж, при котором NPV = 0
    var totalRevenue = self.revenueFlow.reduce(function (s, v) { return s + v; }, 0);
    var totalCost = self.costFlow.reduce(function (s, v) { return s + v; }, 0);

    if (totalRevenue <= 0) {
        self.breakevenRevenue = -1;
        return;
    }

    // Коэффициент масштабирования выручки для NPV = 0
    var low = 0, high = 3;
    var npvAtScale = function (scale) {
        var origRev = self.revenueFlow.slice();
        var origCost = self.costFlow.slice();
        for (var i = 0; i < self.horizon; i++) {
            self.revenueFlow[i] *= scale;
            var varPart = self.costFlow[i] * 0.7;
            var fixedPart = self.costFlow[i] * 0.3;
            self.costFlow[i] = varPart * scale + fixedPart;
        }
        self._calculateNetFlow();
        self._calculateDiscounted();
        var npv = self.cumulativeDiscounted[self.horizon - 1];
        self.revenueFlow = origRev;
        self.costFlow = origCost;
        self._calculateNetFlow();
        self._calculateDiscounted();
        return npv;
    };

    for (var i = 0; i < 50; i++) {
        var mid = (low + high) / 2;
        var npv = npvAtScale(mid);
        if (Math.abs(npv) < 1000) { self.breakevenRevenue = mid; return; }
        if (npv < 0) low = mid; else high = mid;
    }
    self.breakevenRevenue = (low + high) / 2;
};

// ==================== АНАЛИЗ СЦЕНАРИЕВ ====================
Project.prototype._calculateScenarios = function () {
    var self = this;
    self.scenarioResults = {};

    var origRev = self.revenueFlow.slice();
    var origCost = self.costFlow.slice();

    ['optimistic', 'pessimistic'].forEach(function (scName) {
        var sc = self.scenarios[scName];
        if (!sc) return;

        for (var i = 0; i < self.horizon; i++) {
            self.revenueFlow[i] = origRev[i] * (sc.revenueMul || 1);
            self.costFlow[i] = origCost[i] * (sc.costMul || 1);
        }
        self._calculateNetFlow();
        self._calculateDiscounted();
        self.scenarioResults[scName] = {
            npv: self.cumulativeDiscounted[self.horizon - 1],
            irr: self._calculateIRR(),
            paybackPeriod: self.cumulativeFlow.findIndex(function (v) { return v >= 0; }),
            maxCashGap: Math.min.apply(null, self.cumulativeFlow)
        };
    });

    self.revenueFlow = origRev;
    self.costFlow = origCost;
    self._calculateNetFlow();
    self._calculateDiscounted();

    // Взвешенный NPV
    if (self.scenarioResults.optimistic && self.scenarioResults.pessimistic) {
        self.expectedNPV = self.npv * 0.5 +
            self.scenarioResults.optimistic.npv * 0.25 +
            self.scenarioResults.pessimistic.npv * 0.25;
    }
};

// ==================== АНАЛИЗ ЧУВСТВИТЕЛЬНОСТИ ====================
Project.prototype._calculateSensitivity = function () {
    var self = this;
    var results = [];

    var params = [
        {
            name: 'Выручка',
            apply: function (f) {
                var o = self.revenueFlow.slice();
                for (var i = 0; i < self.horizon; i++) self.revenueFlow[i] *= f;
                self._calculateNetFlow();
                self._calculateDiscounted();
                var n = self.cumulativeDiscounted[self.horizon - 1];
                self.revenueFlow = o;
                self._calculateNetFlow();
                self._calculateDiscounted();
                return n;
            }
        },
        {
            name: 'Расходы',
            apply: function (f) {
                var o = self.costFlow.slice();
                for (var i = 0; i < self.horizon; i++) self.costFlow[i] *= f;
                self._calculateNetFlow();
                self._calculateDiscounted();
                var n = self.cumulativeDiscounted[self.horizon - 1];
                self.costFlow = o;
                self._calculateNetFlow();
                self._calculateDiscounted();
                return n;
            }
        },
        {
            name: 'Ставка дисконта',
            apply: function (f) {
                var o = self.effectiveDiscountRate;
                self.effectiveDiscountRate = o * f;
                self._calculateDiscounted();
                var n = self.cumulativeDiscounted[self.horizon - 1];
                self.effectiveDiscountRate = o;
                self._calculateDiscounted();
                return n;
            }
        }
    ];

    params.forEach(function (param) {
        var row = { name: param.name, values: {} };
        [-0.3, -0.15, 0, 0.15, 0.3].forEach(function (pct) {
            row.values[pct] = pct === 0 ? self.npv : param.apply(1 + pct);
        });
        results.push(row);
    });

    return results;
};

// Вспомогательный метод для проверки
Project.prototype._calculateNPV_at_rate = function (rate) {
    var monthlyR = Math.pow(1 + rate, 1 / 12) - 1;
    var sum = 0;
    for (var t = 0; t < this.horizon; t++) {
        sum += this.netFlow[t] / Math.pow(1 + monthlyR, t);
    }
    return sum;
};
