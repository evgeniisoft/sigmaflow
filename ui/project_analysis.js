// ============================================================
// SIGMAFLOW — МОДУЛЬ ИНВЕСТИЦИОННОГО АНАЛИЗА ПРОЕКТОВ
// ============================================================

function Project(config) {
    this.name = config.name || 'Новый проект';
    this.type = config.type || 'new_product';
    this.horizon = config.horizon || 36;
    this.investments = config.investments || [];
    this.revenues = config.revenues || [];
    this.costs = config.costs || [];
    this.financing = config.financing || { ownFunds: 0 };
    this.discountRate = config.discountRate || 0.21;
    this.taxRate = config.taxRate || 0.25;
    this.ndsRate = config.ndsRate || 0.22;
    this.insuranceRate = config.insuranceRate || 0.30;
    this.season = config.season || [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

    // Рассчитываем
    this.calculate();
}

Project.prototype.calculate = function () {
    var self = this;
    var h = self.horizon;

    // Инициализация массивов
    self.investmentFlow = new Array(h).fill(0);
    self.revenueFlow = new Array(h).fill(0);
    self.costFlow = new Array(h).fill(0);
    self.creditFlow = new Array(h).fill(0);      // поступления кредита
    self.creditRepayment = new Array(h).fill(0);  // погашение тела
    self.interestFlow = new Array(h).fill(0);     // проценты
    self.depreciationFlow = new Array(h).fill(0); // амортизация
    self.taxFlow = new Array(h).fill(0);
    self.netFlow = new Array(h).fill(0);
    self.cumulativeFlow = new Array(h).fill(0);
    self.discountedFlow = new Array(h).fill(0);
    self.cumulativeDiscounted = new Array(h).fill(0);

    // === ИНВЕСТИЦИИ ===
    self.investments.forEach(function (inv) {
        var m = inv.month || 0;
        if (m < h) {
            self.investmentFlow[m] += (inv.amount || 0);
        }
    });

    // === АМОРТИЗАЦИЯ ===
    self.investments.forEach(function (inv) {
        if (inv.type === 'capex' && inv.usefulLife) {
            var monthlyDA = (inv.amount || 0) / (inv.usefulLife || 60);
            var startM = inv.month || 0;
            for (var m = startM; m < Math.min(startM + (inv.usefulLife || 60), h); m++) {
                self.depreciationFlow[m] += monthlyDA;
            }
        }
    });

    // === ВЫРУЧКА ===
    self.revenues.forEach(function (rev) {
        var startM = rev.month || 0;
        var baseAmount = rev.baseAmount || 0;
        var rampUp = rev.rampUpMonths || 0;
        for (var m = startM; m < h; m++) {
            var rampCoef = 1;
            if (rampUp > 0) {
                var monthsSinceStart = m - startM;
                rampCoef = Math.min(1, monthsSinceStart / rampUp);
            }
            var mo = m % 12;
            var seasonCoef = self.season[mo] || 1;
            self.revenueFlow[m] += baseAmount * rampCoef * seasonCoef;
        }
    });

    // === РАСХОДЫ ===
    self.costs.forEach(function (cost) {
        var startM = cost.month || 0;
        var baseAmount = cost.baseAmount || 0;
        var rampUp = cost.rampUpMonths || 0;
        for (var m = startM; m < h; m++) {
            var rampCoef = 1;
            if (rampUp > 0 && cost.type === 'variable') {
                var monthsSinceStart = m - startM;
                rampCoef = Math.min(1, monthsSinceStart / rampUp);
            }
            self.costFlow[m] += baseAmount * rampCoef;
        }
    });

    // === КРЕДИТ ===
    if (self.financing.credit && self.financing.credit.amount > 0) {
        var cr = self.financing.credit;
        var crStart = cr.startMonth || 0;
        var crAmount = cr.amount || 0;
        var crRate = cr.rate || 0;
        var crTerm = cr.term || 12;
        var monthlyRate = crRate / 12;

        // Поступление кредита
        if (crStart < h) {
            self.creditFlow[crStart] = crAmount;
        }

        // Аннуитетный платёж
        var annuity = 0;
        if (monthlyRate > 0) {
            annuity = crAmount * monthlyRate * Math.pow(1 + monthlyRate, crTerm) / (Math.pow(1 + monthlyRate, crTerm) - 1);
        } else {
            annuity = crAmount / crTerm;
        }

        var remainingDebt = crAmount;
        for (var m = crStart + 1; m < Math.min(crStart + 1 + crTerm, h); m++) {
            var interest = remainingDebt * monthlyRate;
            var body = annuity - interest;
            self.interestFlow[m] += interest;
            self.creditRepayment[m] += body;
            remainingDebt -= body;
        }
    }

    // === НАЛОГ НА ПРИБЫЛЬ ===
    for (var m = 0; m < h; m++) {
        var taxableIncome = self.revenueFlow[m] - self.costFlow[m] - self.interestFlow[m] - self.depreciationFlow[m];
        if (taxableIncome > 0) {
            self.taxFlow[m] = taxableIncome * self.taxRate;
        }
    }

    // === ЧИСТЫЙ ПОТОК ===
    var cumCash = 0;
    for (var m = 0; m < h; m++) {
        self.netFlow[m] = self.revenueFlow[m]
            - self.costFlow[m]
            - self.investmentFlow[m]
            + self.creditFlow[m]
            - self.creditRepayment[m]
            - self.interestFlow[m]
            - self.taxFlow[m];
        cumCash += self.netFlow[m];
        self.cumulativeFlow[m] = cumCash;
    }

    // === ДИСКОНТИРОВАННЫЙ ПОТОК ===
    var monthlyRate = Math.pow(1 + self.discountRate, 1 / 12) - 1;
    for (var m = 0; m < h; m++) {
        self.discountedFlow[m] = self.netFlow[m] / Math.pow(1 + monthlyRate, m);
    }
    var cumDisc = 0;
    for (var m = 0; m < h; m++) {
        cumDisc += self.discountedFlow[m];
        self.cumulativeDiscounted[m] = cumDisc;
    }

    // === КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ ===

    // NPV
    self.npv = self.cumulativeDiscounted[h - 1];

    // IRR (итеративно)
    self.irr = self._calculateIRR();

    // Срок окупаемости (простой)
    self.paybackPeriod = -1;
    for (var m = 0; m < h; m++) {
        if (self.cumulativeFlow[m] >= 0) {
            self.paybackPeriod = m;
            break;
        }
    }

    // Дисконтированный срок окупаемости
    self.discountedPayback = -1;
    for (var m = 0; m < h; m++) {
        if (self.cumulativeDiscounted[m] >= 0) {
            self.discountedPayback = m;
            break;
        }
    }

    // ROI
    var totalInvestment = self.investments.reduce(function (s, inv) { return s + (inv.amount || 0); }, 0);
    var totalNetFlow = self.netFlow.reduce(function (s, v) { return s + v; }, 0);
    self.roi = totalInvestment > 0 ? (totalNetFlow / totalInvestment * 100) : 0;

    // PI
    self.pi = totalInvestment > 0 ? (self.npv + totalInvestment) / totalInvestment : 0;

    // Максимальный кассовый разрыв
    self.maxCashGap = Math.min.apply(null, self.cumulativeFlow);

    // Месяц максимального разрыва
    self.maxGapMonth = self.cumulativeFlow.indexOf(self.maxCashGap);

    // === АНАЛИЗ ЧУВСТВИТЕЛЬНОСТИ ===
   // === self.sensitivity = self._calculateSensitivity(); ===
};

// IRR методом Ньютона-Рафсона
Project.prototype._calculateIRR = function () {
    var self = this;
    var flows = self.netFlow;
    var guess = 0.1;
    var maxIter = 100;
    var tol = 1e-6;

    for (var iter = 0; iter < maxIter; iter++) {
        var npv = 0, dnpv = 0;
        for (var t = 0; t < flows.length; t++) {
            npv += flows[t] / Math.pow(1 + guess, t);
            dnpv += -t * flows[t] / Math.pow(1 + guess, t + 1);
        }
        if (Math.abs(dnpv) < tol) break;
        var newGuess = guess - npv / dnpv;
        if (Math.abs(newGuess - guess) < tol) return newGuess;
        guess = newGuess;
    }
    return guess;
};

// Анализ чувствительности
Project.prototype._calculateSensitivity = function () {
    var self = this;
    var baseNPV = self.npv;
    var results = [];

    var params = [
        {
            name: 'Выручка',
            apply: function (factor) {
                // Сохраняем оригинал
                var origRev = self.revenueFlow.slice();
                // Временно меняем
                for (var i = 0; i < self.horizon; i++) self.revenueFlow[i] *= factor;
                // Считаем NPV вручную без полного пересчёта
                var npv = self._calculateNPV();
                // Возвращаем
                self.revenueFlow = origRev;
                return npv;
            }
        },
        {
            name: 'Расходы',
            apply: function (factor) {
                var origCost = self.costFlow.slice();
                for (var i = 0; i < self.horizon; i++) self.costFlow[i] *= factor;
                var npv = self._calculateNPV();
                self.costFlow = origCost;
                return npv;
            }
        },
        {
            name: 'Ставка дисконтирования',
            apply: function (factor) {
                var origDR = self.discountRate;
                self.discountRate = origDR * factor;
                var npv = self._calculateNPV();
                self.discountRate = origDR;
                return npv;
            }
        }
    ];

    params.forEach(function (param) {
        var row = { name: param.name, values: {} };
        [-0.3, -0.15, 0, 0.15, 0.3].forEach(function (pct) {
            if (pct === 0) {
                row.values[pct] = baseNPV;
            } else {
                row.values[pct] = param.apply(1 + pct);
            }
        });
        results.push(row);
    });

    return results;
};

// Быстрый расчёт NPV без пересчёта всего проекта
Project.prototype._calculateNPV = function () {
    var self = this;
    var monthlyRate = Math.pow(1 + self.discountRate, 1 / 12) - 1;
    var npv = 0;
    for (var m = 0; m < self.horizon; m++) {
        var netFlow = self.revenueFlow[m] - self.costFlow[m] - self.investmentFlow[m]
            + self.creditFlow[m] - self.creditRepayment[m] - self.interestFlow[m] - self.taxFlow[m];
        npv += netFlow / Math.pow(1 + monthlyRate, m);
    }
    return npv;
};
