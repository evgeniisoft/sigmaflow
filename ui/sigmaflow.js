/**
 * SIGMAFLOW v2.0 — Ядро системы
 * Классы: Node, Edge, Constraint, Graph
 * Функции: computeEdge, parseYAML, toYAML, selfCheck
 * Поддержка периодов планирования
 */

// ============================================================
// МАТЕМАТИЧЕСКИЕ МОДЕЛИ СВЯЗЕЙ
// ============================================================

function computeEdge(edgeType, coefficient, inputValue, threshold, above, below) {
    switch (edgeType) {
        case 'LIN':
            return coefficient * inputValue;
        case 'LOG':
            if (inputValue <= 0) return 0;
            return coefficient * Math.log(inputValue);
        case 'EXP':
            if (inputValue > 50) inputValue = 50;
            return coefficient * Math.exp(inputValue);
        case 'DIM':
            if (inputValue < 0) return 0;
            return coefficient * Math.sqrt(inputValue);
        case 'THR':
            if (inputValue >= threshold) {
                return above !== undefined && above !== null ? above : inputValue;
            } else {
                return below !== undefined && below !== null ? below : 0;
            }
        default:
            throw new Error('Неизвестный тип связи: ' + edgeType);
    }
}

// ============================================================
// КЛАССЫ МОДЕЛИ
// ============================================================

function Node(id, type, value, min, max, source, label, enabled, temporalType) {
    this.id = id;
    this.type = type;
    this.value = value !== undefined && value !== null ? value : null;
    this.min = min !== undefined && min !== null ? min : null;
    this.max = max !== undefined && max !== null ? max : null;
    this.source = source || 'manual';
    this.label = label || id;
    this.enabled = enabled !== undefined ? enabled : true;
    this.temporalType = temporalType || 'CONSTANT';
    this.values = [];
    this.formula = null;
}

Node.prototype.toDict = function () {
    var r = {
        id: this.id,
        type: this.type,
        source: this.source,
        label: this.label,
        enabled: this.enabled
    };
    if (this.temporalType !== 'CONSTANT') r.temporalType = this.temporalType;
    if (this.formula) r.formula = this.formula;
    if (this.value !== null) r.value = this.value;
    if (this.min !== null) r.min = this.min;
    if (this.max !== null) r.max = this.max;
    return r;
};

Node.fromDict = function (data) {
    var n = new Node(
        data.id, data.type, data.value, data.min, data.max,
        data.source, data.label, data.enabled, data.temporalType
    );
    if (data.formula) n.formula = data.formula;
    return n;
};

function Edge(fromNode, toNode, type, coefficient, lagDays, threshold, above, below) {
    this.from = fromNode;
    this.to = toNode;
    this.type = type || 'LIN';
    this.coefficient = coefficient !== undefined ? coefficient : null;
    this.lag_days = lagDays || 0;
    this.threshold = threshold !== undefined ? threshold : null;
    this.above = above !== undefined ? above : null;
    this.below = below !== undefined ? below : null;
}

Edge.prototype.toDict = function () {
    var r = { from: this.from, to: this.to, type: this.type };
    if (this.coefficient !== null) r.coefficient = this.coefficient;
    if (this.lag_days) r.lag_days = this.lag_days;
    if (this.threshold !== null) r.threshold = this.threshold;
    if (this.above !== null) r.above = this.above;
    if (this.below !== null) r.below = this.below;
    return r;
};

Edge.fromDict = function (data) {
    return new Edge(
        data.from,
        data.to,
        data.type,
        data.coefficient,
        data.lag_days,
        data.threshold,
        data.above,
        data.below
    );
};

function Constraint(node, operator, value) {
    this.node = node;
    this.operator = operator;
    this.value = value;
}

function Graph(name) {
    this.name = name || '';
    this.nodes = {};
    this.edges = [];
    this.constraints = [];
    this.diagnostics = [];
    this.horizon = 12;
    this.stepMonths = 1;
    this.currentPeriod = 0;
}

Graph.prototype.addNode = function (node) {
    this.nodes[node.id] = node;
};

Graph.prototype.addEdge = function (edge) {
    this.edges.push(edge);
};

Graph.prototype.addConstraint = function (c) {
    this.constraints.push(c);
};

Graph.prototype.compute = function (iterations) {
    iterations = iterations || 1;
    for (var iter = 0; iter < iterations; iter++) {
        this._computeOnce();
    }
    this._savePlanForecast();
    this.updateBalanceFromInvestments();
    this.updateBalanceFromCredits();
};

Graph.prototype._savePlanForecast = function () {
    var self = this;
    if (!self.planForecast) self.planForecast = { generated: '', periods: {} };
    self.planForecast.generated = new Date().toISOString();

    var now = new Date();
    var startMonth = now.getMonth();
    var horizon = 12;

    for (var p = 0; p < horizon; p++) {
        var mo = (startMonth + p) % 12;
        var yr = now.getFullYear() + Math.floor((startMonth + p) / 12);
        var period = yr + '-' + String(mo + 1).padStart(2, '0');

        self.planForecast.periods[period] = {};
        Object.keys(self.nodes).forEach(function (key) {
            var n = self.nodes[key];
            if (n.value !== null && n.value !== undefined) {
                self.planForecast.periods[period][key] = n.value;
            }
        });
    }
};

Graph.prototype.updateBalanceFromInvestments = function () {
    var self = this;
    if (!self.investments) return;

    var totalCapex = 0;
    self.investments.forEach(function (inv) {
        totalCapex += inv.cost || 0;
    });

    if (self.nodes['FIXED_ASSETS']) {
        // FIXED_ASSETS = начальная стоимость + сумма инвестиций
        var baseFA = self.nodes['FIXED_ASSETS_START'] ? self.nodes['FIXED_ASSETS_START'].value : (self.nodes['FIXED_ASSETS'].value || 0);
        self.nodes['FIXED_ASSETS'].value = baseFA + totalCapex;
    }
};

Graph.prototype.updateBalanceFromCredits = function () {
    var self = this;
    if (!self.credits) return;

    var totalLoans = 0;
    var totalRepayment = 0;
    self.credits.forEach(function (cr) {
        totalLoans += cr.amount || 0;
        totalRepayment += (cr.amount || 0) / (cr.term || 12);
    });

    if (self.nodes['LOANS']) {
        self.nodes['LOANS'].value = totalLoans;
    }
    if (self.nodes['LOAN_REPAYMENT']) {
        self.nodes['LOAN_REPAYMENT'].value = totalRepayment;
    }
};

Graph.prototype._computeOnce = function () {
    var self = this;

    // Шаг 1: вычисляем узлы с формулами (используем стрелочные функции для сохранения this)
    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if (n.formula && n.enabled !== false) {
            try {
                n.value = self._evalFormula(n.formula);
            } catch (e) {
                console.error('Ошибка вычисления узла ' + key + ':', e.message);
                n.value = 0;
            }
        }
    });

    // Шаг 2: сброс вычисляемых узлов без формул
    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if ((n.type === 'INTERMEDIATE' || n.type === 'TARGET') && !n.formula) {
            n.value = 0;
        }
    });

    // Шаг 3: суммируем вклады по рёбрам
    self.edges.forEach(function (edge) {
        var fromNode = self.nodes[edge.from];
        var toNode = self.nodes[edge.to];
        if (!fromNode || !toNode) return;
        if (fromNode.enabled === false || toNode.enabled === false) return;
        if (fromNode.value === null || fromNode.value === undefined) return;
        if (toNode.formula) return;
        if (toNode.type !== 'INTERMEDIATE' && toNode.type !== 'TARGET') return;

        var coeff = edge.coefficient !== null ? edge.coefficient : 1.0;
        var contrib = computeEdge(edge.type, coeff, fromNode.value, edge.threshold, edge.above, edge.below);
        toNode.value = (toNode.value || 0) + contrib;
    });
};

Graph.prototype._evalFormula = function (formula) {
    var self = this;
    try {
        if (!formula) return 0;
        // Убираем внешние кавычки (могут остаться от YAML-парсинга)
        var expr = String(formula).replace(/^"(.*)"$/, '$1');

        var sortedKeys = Object.keys(self.nodes).sort(function (a, b) {
            return b.length - a.length;
        });

        sortedKeys.forEach(function (key) {
            var n = self.nodes[key];
            var val = n.value !== null && n.value !== undefined ? n.value : 0;
            var regex = new RegExp('\\b' + key + '\\b', 'g');
            expr = expr.replace(regex, val);
        });

        expr = expr.replace(/\bMAX\b/gi, 'Math.max');
        expr = expr.replace(/\bMIN\b/gi, 'Math.min');
        expr = expr.replace(/\bABS\b/gi, 'Math.abs');
        expr = expr.replace(/\bSQRT\b/gi, 'Math.sqrt');

        var result = new Function('return (' + expr + ');')();
        return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch (e) {
        console.error('Ошибка в формуле "' + formula + '":', e.message);
        return 0;
    }
};

// ============================================================
// ПЕРИОДЫ ПЛАНИРОВАНИЯ
// ============================================================
Graph.prototype.computePeriods = function (horizon, stepMonths) {
    horizon = horizon || this.horizon || 12;
    stepMonths = stepMonths || this.stepMonths || 1;
    var periods = Math.floor(horizon / stepMonths);
    var self = this;
    this.horizon = horizon;
    this.stepMonths = stepMonths;

    // Инициализация values
    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        n.values = [];
        for (var i = 0; i < periods; i++) {
            if (n.type === 'INPUT' || n.type === 'EXTERNAL') {
                n.values.push(n.value);
            } else {
                n.values.push(0);
            }
        }
    });

    // Для каждого периода
    for (var p = 0; p < periods; p++) {
        // Сохраняем оригинальные value и подставляем values[p]
        Object.keys(self.nodes).forEach(function (key) {
            var n = self.nodes[key];
            n._savedValue = n.value;
            n.value = n.values[p];
        });

        // Вычисляем формулы
        Object.keys(self.nodes).forEach(function (key) {
            var n = self.nodes[key];
            if (n.formula && n.enabled !== false) {
                try {
                    n.values[p] = self._evalFormula(n.formula);
                    n.value = n.values[p];
                } catch (e) {
                    n.values[p] = 0;
                    n.value = 0;
                }
            }
        });

        // Сброс вычисляемых узлов без формул
        Object.keys(self.nodes).forEach(function (key) {
            var n = self.nodes[key];
            if ((n.type === 'INTERMEDIATE' || n.type === 'TARGET') && !n.formula) {
                n.values[p] = 0;
                n.value = 0;
            }
        });

        // Суммируем вклады по рёбрам
        self.edges.forEach(function (edge) {
            var fromNode = self.nodes[edge.from];
            var toNode = self.nodes[edge.to];
            if (!fromNode || !toNode) return;
            if (fromNode.enabled === false || toNode.enabled === false) return;
            if (fromNode.value === null || fromNode.value === undefined) return;
            if (toNode.formula) return;
            if (toNode.type !== 'INTERMEDIATE' && toNode.type !== 'TARGET') return;

            var coeff = edge.coefficient !== null ? edge.coefficient : 1.0;
            var contrib = computeEdge(edge.type, coeff, fromNode.value, edge.threshold, edge.above, edge.below);
            toNode.values[p] = (toNode.values[p] || 0) + contrib;
            toNode.value = toNode.values[p];
        });

        // Восстанавливаем оригинальные value
        Object.keys(self.nodes).forEach(function (key) {
            var n = self.nodes[key];
            if (n._savedValue !== undefined) {
                n.value = n._savedValue;
            }
        });
    }

    return periods;
};

Graph.prototype.getPeriodValue = function (nodeId, periodIndex) {
    var n = this.nodes[nodeId];
    if (!n) return null;
    if (n.values && n.values.length > 0 && periodIndex !== undefined && periodIndex < n.values.length) {
        return n.values[periodIndex];
    }
    if (n.values && n.values.length > 0) {
        var sum = 0;
        for (var i = 0; i < n.values.length; i++) {
            sum += (n.values[i] || 0);
        }
        return sum;
    }
    return n.value;
};

Graph.prototype.getCashFlowCalendar = function (startMonth, horizon) {
    var self = this;
    horizon = horizon || 12;
    startMonth = startMonth !== undefined ? startMonth : new Date().getMonth();

    // Годовые значения из модели
    var revY = self._val('REVENUE');
    var matY = self._val('MATERIAL_COST');
    var enerY = self._val('ENERGY_COST');
    var logY = self._val('LOGISTICS_COST');
    var prodY = self._val('DIRECT_LABOR');
    var admY = self._val('ADMIN_PAYROLL');
    var markY = self._val('MARKETING');
    var rentY = self._val('RENT');
    var itY = self._val('IT_EXP');
    var rdY = self._val('RD_EXP');
    var trainY = self._val('TRAINING_EXP');
    var daY = self._val('DA');
    var intIncY = self._val('INTEREST_INCOME');
    var othIncY = self._val('OTHER_INCOME');
    var othExpY = self._val('OTHER_EXP');
    var penY = self._val('PENALTIES');
    var divY = self._val('DIVIDENDS');

    // Кредиты из кредитного портфеля
    var repayY = 0;
    var newLoansY = 0;
    var loanSch = [];
    var newLoanSch = [];
    var intSch = [];
    for (var i = 0; i < horizon; i++) { loanSch.push(0); newLoanSch.push(0); intSch.push(0); }
    if (self.credits) {
        self.credits.forEach(function (cr) {
            var amount = cr.amount || 0;
            var term = cr.term || 12;
            var bodyPayment = amount / term;
            var monthlyInterest = amount * (cr.rate || 0) / 12;

            var crStartMonth = (cr.startMonth || 0) - startMonth;
            if (crStartMonth < 0) crStartMonth += 12;

            // Новый кредит — приход в месяц получения
            if (crStartMonth >= 0 && crStartMonth < newLoanSch.length) {
                newLoanSch[crStartMonth] = (newLoanSch[crStartMonth] || 0) + amount;
            }

            // Тело кредита — погашение со следующего месяца
            for (var j = 1; j < horizon && j <= term; j++) {
                var idx = crStartMonth + j;
                if (idx >= 0 && idx < loanSch.length) {
                    loanSch[idx] = (loanSch[idx] || 0) + bodyPayment;
                }
            }

            // Проценты — со следующего месяца
            for (var j = 1; j < horizon && j <= term; j++) {
                var idx = crStartMonth + j;
                if (idx >= 0 && idx < intSch.length) {
                    intSch[idx] = (intSch[idx] || 0) + monthlyInterest;
                }
            }

            repayY += amount;
            newLoansY += amount;
        });
    }

    // CAPEX из инвестиционного портфеля
    var capexY = 0;
    var capexSch = [];
    for (var i = 0; i < horizon; i++) capexSch.push(0);
    if (self.investments) {
        self.investments.forEach(function (inv) {
            var schedule = inv.schedule || [];
            var start = inv.start || 0;
            for (var j = 0; j < schedule.length; j++) {
                var monthIdx = start - startMonth + j;
                if (monthIdx < 0) monthIdx += 12;
                if (monthIdx >= 0 && monthIdx < capexSch.length) {
                    capexSch[monthIdx] = (capexSch[monthIdx] || 0) + (schedule[j] || 0);
                }
            }
            capexY += inv.cost || 0;
        });
    }

    // Стартовый остаток
    var cashStart = self._val('CASH_START');
    if (cashStart === 0 && self.nodes['CASH']) cashStart = self._val('CASH');

    // Налоги
    var ebtY = self._val('EBT');
    var taxRate = self._val('TAX_RATE') || 0.20;
    var annualProfitTax = Math.max(0, ebtY) * taxRate;
    var quarterlyTax = annualProfitTax / 4;

    // ФОТ для страховых и НДФЛ
    var monthlyPayroll = prodY + admY;
    var insRate = self._company('insurance_rate', 0.30);
    var monthlyInsurance = monthlyPayroll * insRate;
    var monthlyNDFL = monthlyPayroll * 0.13;

    // НДС
    var ndsRate = self._company('nds_rate', 0.20);
    var ndsExempt = self._company('nds_exempt', false);
    var hasNDS = !ndsExempt && ndsRate > 0;
    var monthlyRevenueForNDS = revY;
    // Отсрочка платежей клиентов
    var receivablesDays = self._company('receivables_days', 30);
    var receivablesDelay = Math.round(receivablesDays / 30); // в месяцах
    var revenueReceived = [];
    for (var i = 0; i < horizon; i++) revenueReceived.push(0);
    for (var i = 0; i < horizon; i++) {
        var targetMonth = i + receivablesDelay;
        if (targetMonth < horizon) {
            revenueReceived[targetMonth] = (revenueReceived[targetMonth] || 0) + revY;
        } else {
            revenueReceived[i] = (revenueReceived[i] || 0) + revY;
        }
    }
    var monthlyNDSaccrued = monthlyRevenueForNDS * ndsRate / (1 + ndsRate);
    var quarterlyNDS = monthlyNDSaccrued * 3;
    var ndsMonthlyPayment = quarterlyNDS / 3;

    // Налог на имущество
    var propertyTaxRate = self._company('property_tax_rate', 0);
    var hasPropertyTax = self._company('has_property_tax', false);
    var fixedAssets = self._val('FIXED_ASSETS');
    var annualPropertyTax = hasPropertyTax ? fixedAssets * propertyTaxRate : 0;
    var monthlyPropertyTax = annualPropertyTax / 12;

    var months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    var cal = [];
    var runningCash = cashStart;
    var totals = { rev: 0, mat: 0, ener: 0, log: 0, prod: 0, adm: 0, mark: 0, rent: 0, it: 0, tax: 0, int: 0, pen: 0, repay: 0, newLoan: 0, capex: 0, div: 0 };

    for (var p = 0; p < horizon; p++) {
        var mo = (startMonth + p) % 12;
        var yr = 2026 + Math.floor((startMonth + p) / 12);
        var label = months[mo] + ' ' + yr;

        // Налог на прибыль — квартальные авансы
        var profitTax = 0;
        if (mo === 2) profitTax = quarterlyTax;
        if (mo === 3) profitTax = quarterlyTax;
        if (mo === 6) profitTax = quarterlyTax;
        if (mo === 9) profitTax = quarterlyTax;

        // НДС — уплата в следующем квартале
        var ndsThis = 0;
        if (hasNDS) {
            if (mo === 3 || mo === 4 || mo === 5) ndsThis = ndsMonthlyPayment;
            if (mo === 6 || mo === 7 || mo === 8) ndsThis = ndsMonthlyPayment;
            if (mo === 9 || mo === 10 || mo === 11) ndsThis = ndsMonthlyPayment;
            if (mo === 0 || mo === 1 || mo === 2) ndsThis = ndsMonthlyPayment;
        }

        var taxThisMonth = profitTax + monthlyInsurance + monthlyNDFL + ndsThis + monthlyPropertyTax;

        // Приходы
        var inflow = (revY ) + (intIncY ) + (othIncY) + newLoanSch[p];

        // Расходы
        var outflow = (matY) + (enerY) + (logY) + (prodY) + (admY)
            + (markY) + (rentY) + ((itY + rdY + trainY) / 12)
            + taxThisMonth + (intSch[p]) + (othExpY) + (penY)
            + loanSch[p] + capexSch[p] + (divY);

        var netFlow = inflow - outflow;
        var startCashPeriod = runningCash;
        runningCash += netFlow;

        cal.push({
            period: p, label: label, month: mo,
            startCash: startCashPeriod,
            revenue: revenueReceived[p],
            material: matY,
            energy: enerY,
            logistics: logY,
            payrollProd: prodY,
            payrollAdm: admY,
            marketing: markY,
            rent: rentY,
            itRdTraining: (itY + rdY + trainY) / 12,
            da: daY / 12,
            profitTax: profitTax,
            nds: ndsThis,
            insurance: monthlyInsurance,
            ndfl: monthlyNDFL,
            propertyTax: monthlyPropertyTax,
            totalTax: taxThisMonth,
            interest: intSch[p],
            interestIncome: intIncY ,
            otherIncome: othIncY,
            otherExp: othExpY,
            penalties: penY,
            loanRepayment: loanSch[p],
            newLoans: newLoanSch[p],
            capex: capexSch[p],
            dividends: divY,
            netFlow: netFlow,
            endCash: runningCash,
            isGap: runningCash < 0,
            isWarning: netFlow < 0 && runningCash >= 0
        });

        totals.rev += revenueReceived[p]; totals.mat += matY; totals.ener += enerY;
        totals.log += logY; totals.prod += prodY; totals.adm += admY;
        totals.mark += markY; totals.rent += rentY; totals.it += (itY + rdY + trainY) / 12;
        totals.tax += taxThisMonth; totals.int += intSch[p]; totals.pen += penY;
        totals.repay += loanSch[p]; totals.newLoan += newLoanSch[p];
        totals.capex += capexSch[p]; totals.div += divY;
    }

    return {
        periods: cal, startMonth: startMonth,
        totals: totals, endCash: runningCash,
        gapCount: cal.filter(function (p) { return p.isGap; }).length,
        warningCount: cal.filter(function (p) { return p.isWarning; }).length
    };
};

Graph.prototype.getPnL = function (startMonth, horizon) {
    var self = this;
    horizon = horizon || 12;
    startMonth = startMonth !== undefined ? startMonth : new Date().getMonth();

    var revY = self._val('REVENUE');
    var cogsY = self._val('COGS');
    var sellY = self._val('SELLING_EXP');
    var admY = self._val('ADMIN_EXP');
    var daY = self._val('DA');
    var intSch = [];
    for (var i = 0; i < horizon; i++) intSch.push(0);
    if (self.credits) {
        self.credits.forEach(function (cr) {
            var amount = cr.amount || 0;
            var term = cr.term || 12;
            var monthlyInterest = amount * (cr.rate || 0) / 12;
            var crStart = (cr.startMonth || 0) - startMonth;
            if (crStart < 0) crStart += 12;
            for (var j = 1; j < horizon && j <= term; j++) {
                var idx = crStart + j;
                if (idx >= 0 && idx < intSch.length) {
                    intSch[idx] = (intSch[idx] || 0) + monthlyInterest;
                }
            }
        });
    }
    var otherIncY = self._val('OTHER_INCOME');
    var otherExpY = self._val('OTHER_EXP');
    var penY = self._val('PENALTIES');
    var ebtY = self._val('EBT');
    var taxRate = self._company('profit_tax_rate', 0.25);
    var annualTax = Math.max(0, ebtY) * taxRate;
    var quarterlyTax = annualTax / 4;

    var months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    var rows = [];
    var totals = { rev: 0, cogs: 0, gross: 0, sell: 0, adm: 0, ebitda: 0, da: 0, ebit: 0, int: 0, ebt: 0, tax: 0, net: 0 };
    var cumulative = 0;

    for (var p = 0; p < horizon; p++) {
        var mo = (startMonth + p) % 12;
        var label = months[mo] + ' ' + (2026 + Math.floor((startMonth + p) / 12));

        var revenue = revY;
        var cogs = -Math.abs(cogsY);
        var gross = revenue + cogs;
        var selling = -Math.abs(sellY);
        var admin = -Math.abs(admY);
        var ebitda = gross + selling + admin;
        var da = -Math.abs(daY);
        var ebit = ebitda + da;
        var interest = -Math.abs(intSch[p]);
        var other = (otherIncY || 0) - Math.abs(otherExpY || 0) - Math.abs(penY || 0);
        var ebt = ebit + interest + other;

        var profitTax = 0;
        if (mo === 2 || mo === 3 || mo === 6 || mo === 9) {
            profitTax = -quarterlyTax;
        }

        var net = ebt + profitTax;
        cumulative += net;

        rows.push({
            label: label,
            revenue: revenue, cogs: cogs, gross: gross,
            selling: selling, admin: admin, ebitda: ebitda,
            da: da, ebit: ebit,
            interest: interest, other: other, ebt: ebt,
            tax: profitTax, net: net, cumulative: cumulative
        });

        totals.rev += revenue; totals.cogs += cogs; totals.gross += gross;
        totals.sell += selling; totals.adm += admin; totals.ebitda += ebitda;
        totals.da += da; totals.ebit += ebit; totals.int += interest;
        totals.ebt += ebt; totals.tax += profitTax; totals.net += net;
    }

    return { rows: rows, totals: totals, endCumulative: cumulative };
};

Graph.prototype.getMarginalEffects = function() {
    var self = this;
    var saved = {};
    Object.keys(self.nodes).forEach(function(key) {
        saved[key] = self.nodes[key].value;
    });
    
    self.compute();
    var baseProfit = self.nodes['NET_PROFIT'] ? self.nodes['NET_PROFIT'].value : 0;
    var baseRevenue = self.nodes['REVENUE'] ? Math.abs(self.nodes['REVENUE'].value) : 1;
    
    var effects = [];
    
    Object.keys(self.nodes).forEach(function(key) {
        var n = self.nodes[key];
        if (n.type !== 'INPUT' && n.type !== 'EXTERNAL') return;
        if (n.value === null || n.value === 0) return;
        if (n.enabled === false) return;
        
        var delta = n.value * 0.01;
        if (Math.abs(delta) < 0.001) delta = 0.01;
        
        Object.keys(saved).forEach(function(k) { self.nodes[k].value = saved[k]; });
        
        n.value = n.value + delta;
        self.compute();
        var newProfit = self.nodes['NET_PROFIT'] ? self.nodes['NET_PROFIT'].value : 0;
        var profitDelta = newProfit - baseProfit;
        
        effects.push({
            node: key,
            label: n.label || key,
            type: n.type,
            currentValue: saved[key],
            min: n.min,
            max: n.max,
            step: Number.isInteger(saved[key]) ? 1 : (Math.abs(saved[key]) > 100 ? Math.round(Math.abs(saved[key]) / 100) : 0.01),
            profitDelta: profitDelta,
            profitDelta10: profitDelta * 10,
            impactPct: baseRevenue !== 0 ? (Math.abs(profitDelta) / baseRevenue * 100).toFixed(1) : 0
        });
    });
    
    Object.keys(saved).forEach(function(k) { self.nodes[k].value = saved[k]; });
    self.compute();
    
    effects.sort(function(a, b) { return Math.abs(b.profitDelta) - Math.abs(a.profitDelta); });
    return effects;
};

// Вспомогательные функции для регрессии
function mean(arr) {
    var sum = 0, n = arr.length;
    for (var i = 0; i < n; i++) sum += arr[i];
    return n > 0 ? sum / n : 0;
}

function dot(a, b) {
    var s = 0, n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) s += a[i] * b[i];
    return s;
}

function transpose(m) {
    var rows = m.length, cols = m[0].length;
    var t = [];
    for (var j = 0; j < cols; j++) { t[j] = []; for (var i = 0; i < rows; i++) t[j][i] = m[i][j]; }
    return t;
}

function matMul(a, b) {
    var rows = a.length, cols = b[0].length, inner = b.length;
    var r = [];
    for (var i = 0; i < rows; i++) { r[i] = []; for (var j = 0; j < cols; j++) { r[i][j] = 0; for (var k = 0; k < inner; k++) r[i][j] += a[i][k] * b[k][j]; } }
    return r;
}

function invert2x2(m) {
    var det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (Math.abs(det) < 1e-10) return null;
    return [[m[1][1] / det, -m[0][1] / det], [-m[1][0] / det, m[0][0] / det]];
}

function linearRegression(X, y) {
    var n = X.length;
    if (n < 2) return null;
    var p = X[0].length;

    // XtX
    var XtX = [];
    for (var i = 0; i < p; i++) { XtX[i] = []; for (var j = 0; j < p; j++) { XtX[i][j] = 0; for (var k = 0; k < n; k++) XtX[i][j] += X[k][i] * X[k][j]; } }

    // Xty
    var Xty = [];
    for (var i = 0; i < p; i++) { Xty[i] = 0; for (var k = 0; k < n; k++) Xty[i] += X[k][i] * y[k]; }

    // Решение для p=2 через аналитическую формулу
    if (p === 2) {
        var inv = invert2x2(XtX);
        if (!inv) return null;
        var beta = [inv[0][0] * Xty[0] + inv[0][1] * Xty[1], inv[1][0] * Xty[0] + inv[1][1] * Xty[1]];

        // R²
        var yMean = mean(y);
        var ssRes = 0, ssTot = 0;
        for (var i = 0; i < n; i++) { var pred = beta[0] * X[i][0] + beta[1] * X[i][1]; ssRes += (y[i] - pred) * (y[i] - pred); ssTot += (y[i] - yMean) * (y[i] - yMean); }
        var r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

        return { coefficients: beta, r2: r2 };
    }

    // Для p=1 — парная регрессия
    if (p === 1) {
        var xMean = mean(X.map(function (r) { return r[0]; }));
        var numerator = 0, denominator = 0;
        for (var i = 0; i < n; i++) { var dx = X[i][0] - xMean; numerator += dx * (y[i] - yMean); denominator += dx * dx; }
        if (denominator === 0) return null;
        var slope = numerator / denominator;
        var intercept = yMean - slope * xMean;
        var ssRes = 0, ssTot = 0;
        for (var i = 0; i < n; i++) { var pred = intercept + slope * X[i][0]; ssRes += (y[i] - pred) * (y[i] - pred); ssTot += (y[i] - yMean) * (y[i] - yMean); }
        var r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
        return { coefficients: [intercept, slope], r2: r2 };
    }

    return null;
}

Graph.prototype.calibrate = function () {
    var self = this;
    if (!self.history || self.history.length < 2) return { error: 'Недостаточно данных. Нужно минимум 2 периода.' };

    var results = [];

    self.edges.forEach(function (edge) {
        var fromNode = self.nodes[edge.from];
        var toNode = self.nodes[edge.to];
        if (!fromNode || !toNode) return;
        if (toNode.formula) return; // формулы не калибруем
        if (edge.type === 'THR') return; // пороговые связи пока не калибруем

        // Собираем данные из истории
        var xData = [], yData = [];
        self.history.forEach(function (h) {
            if (!h.fact) return;
            var x = h.fact[edge.from];
            var y = h.fact[edge.to];
            if (x !== undefined && x !== null && y !== undefined && y !== null && h.type === 'historical') {
                xData.push(x);
                yData.push(y);
            }
        });

        if (xData.length < 3) return;

        // Парная регрессия: [1, x] → y
        var X = xData.map(function (x) { return [1, x]; });
        var reg = linearRegression(X, yData);
        if (!reg) return;

        var newCoeff = reg.coefficients[1]; // slope
        var oldCoeff = edge.coefficient || 0;

        // Проверка знака
        var expectedSign = null;
        var signPairs = {
            'PRICE': { 'VOLUME': 'negative' },
            'MARKETING': { 'VOLUME': 'positive' },
            'COGS': { 'NET_PROFIT': 'negative' },
            'INTEREST': { 'EBT': 'negative' },
            'REVENUE': { 'NET_PROFIT': 'positive' }
        };
        // ... можно расширить

        var signOk = true;
        var actualSign = newCoeff > 0 ? 'positive' : (newCoeff < 0 ? 'negative' : 'zero');

        results.push({
            from: edge.from,
            to: edge.to,
            oldCoefficient: oldCoeff,
            newCoefficient: Math.round(newCoeff * 10000) / 10000,
            r2: Math.round(reg.r2 * 100) / 100,
            dataPoints: xData.length,
            signOk: signOk,
            actualSign: actualSign
        });
    });

    return results;
};

Graph.prototype.importFactFromCSV = function (csvText) {
    var self = this;
    var lines = csvText.split('\n').filter(function (l) { return l.trim(); });
    if (lines.length < 2) return { error: 'Файл пуст или содержит только заголовки' };

    // Определяем разделитель
    var sep = ',';
    if (lines[0].indexOf(';') >= 0) sep = ';';
    if (lines[0].indexOf('\t') >= 0) sep = '\t';

    // Парсим заголовки
    var headers = lines[0].split(sep).map(function (h) { return h.trim(); });
    var columnMap = {}; // index -> nodeId
    var periodIndex = -1;

    headers.forEach(function (h, i) {
        if (h.toLowerCase() === 'period') {
            periodIndex = i;
        } else {
            // Извлекаем ID из формата "REVENUE (Выручка)" или просто "REVENUE"
            // Извлекаем ID: "NET_PROFIT (...)" или NET_PROFIT (...)
            var cleanH = h.replace(/^"|"$/g, '').replace(/""/g, '"');
            var match = cleanH.match(/^(\w+)/);
            var nodeId = match ? match[1] : cleanH;
            if (self.nodes[nodeId]) {
                columnMap[i] = nodeId;
            }
        }
    });

    if (periodIndex === -1) return { error: 'Не найден столбец period' };
    if (Object.keys(columnMap).length === 0) return { error: 'Не найдено ни одного узла модели в заголовках' };

    // Инициализируем history
    if (!self.history) self.history = [];

    var imported = 0;
    for (var l = 1; l < lines.length; l++) {
        var values = lines[l].split(sep).map(function (v) { return v.trim(); });
        var period = values[periodIndex];
        if (!period) continue;
        // Определяем тип периода
        var isHistorical = true;
        if (self.planForecast && self.planForecast.periods[period]) {
            isHistorical = false;
        }

        var planEntry = {};
        if (!isHistorical) {
            // Для forecast — берём план из planForecast
            planEntry = self.planForecast.periods[period] || {};
        }

        // Сохраняем план (текущие значения модели)
        var planEntry = {};
        Object.keys(columnMap).forEach(function (ci) {
            var nodeId = columnMap[ci];
            var node = self.nodes[nodeId];
            if (node && values[ci] !== '') {
                planEntry[nodeId] = node.value;
            }
        });

        // Применяем фактические значения
        var factEntry = {};
        Object.keys(columnMap).forEach(function (ci) {
            var nodeId = columnMap[ci];
            var node = self.nodes[nodeId];
            if (node && values[ci] !== '' && values[ci] !== undefined) {
                var v = parseFloat(values[ci].replace(',', '.'));
                if (!isNaN(v)) {
                    factEntry[nodeId] = v;
                }
            }
        });

        // Сохраняем в историю
        var existing = self.history.filter(function (h) { return h.period === period; })[0];
        if (existing) {
            // Обновляем факт
            Object.keys(factEntry).forEach(function (k) { existing.fact[k] = factEntry[k]; });
        } else {
            self.history.push({
                period: period,
                type: isHistorical ? 'historical' : 'forecast',
                plan: isHistorical ? null : planEntry,
                fact: factEntry,
                importedAt: new Date().toISOString()
            });
        }
        imported++;
    }

    // Сортируем историю по периодам
    self.history.sort(function (a, b) { return a.period.localeCompare(b.period); });

    return { imported: imported, history: self.history };
};

Graph.prototype.generateCSVTemplate = function () {
    var self = this;
    var sep = ';';
    var headers = ['period'];
    var example = ['2026-07'];
    var inputIds = [];

    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if (n.type === 'INPUT' || n.type === 'EXTERNAL' || n.type === 'TARGET' || n.id === 'REVENUE' || n.id === 'COGS' || n.id === 'EBITDA' || n.id === 'NET_PROFIT') {
            var cleanLabel = (n.label || n.id).replace(/"/g, '');
            headers.push(n.id + ' (' + cleanLabel + ')');
            inputIds.push(n.id);
            // Пример значения: текущее значение узла, если есть
            var v = n.value !== null && n.value !== undefined ? n.value : 0;
            if (typeof v === 'number') {
                example.push(v % 1 === 0 ? v.toString() : v.toFixed(2));
            } else {
                example.push('0');
            }
        }
    });

    return '\uFEFF' + headers.join(sep) + '\n' + example.join(sep) + '\n';
};

Graph.prototype.getPlanFactComparison = function (period) {
    var self = this;
    if (!self.history) return null;

    var entry = self.history.filter(function (h) { return h.period === period; })[0];
    if (!entry) return null;
    if (!entry.plan) return null; // нет плана — не с чем сравнивать

    var comparison = [];
    Object.keys(entry.plan).forEach(function (nodeId) {
        var n = self.nodes[nodeId];
        var planVal = entry.plan[nodeId];
        var factVal = entry.fact[nodeId] !== undefined ? entry.fact[nodeId] : null;
        var delta = factVal !== null && planVal !== null ? factVal - planVal : null;
        var deltaPct = delta !== null && planVal !== 0 ? (delta / Math.abs(planVal) * 100) : null;

        comparison.push({
            node: nodeId,
            label: n ? n.label : nodeId,
            plan: planVal,
            fact: factVal,
            delta: delta,
            deltaPct: deltaPct
        });
    });

    return comparison;
};

// Вспомогательные методы
Graph.prototype._val = function (id) {
    var n = this.nodes[id];
    return n && n.value !== null && n.value !== undefined ? Math.abs(n.value) : 0;
};

Graph.prototype._schedule = function (id, yearTotal, horizon) {
    var n = this.nodes[id];
    var sched = [];
    if (n && n.schedule && n.schedule.length === horizon) {
        sched = n.schedule;
    } else {
        var monthly = (yearTotal || 0) / horizon;
        for (var i = 0; i < horizon; i++) sched.push(monthly);
    }
    return sched;
};

Graph.prototype._company = function (key, defaultVal) {
    if (!this.company) this.company = {};
    var val = this.company[key];
    return val !== undefined ? val : defaultVal;
};

// ============================================================
// САМОДИАГНОСТИКА
// ============================================================

Graph.prototype.selfCheck = function () {
    var self = this;
    self.diagnostics = [];

    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if (n.type === 'INTERMEDIATE' || n.type === 'TARGET') {
            var hasIncoming = self.edges.some(function (e) { return e.to === n.id; });
            if (!hasIncoming) {
                self.diagnostics.push({
                    code: 'S01',
                    level: 'warning',
                    message: 'Узел "' + n.label + '" (' + n.id + ') не имеет входящих связей. Его значение всегда будет равно нулю.',
                    node: n.id
                });
            }
        }
    });

    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if (n.type === 'INPUT' || n.type === 'INTERMEDIATE' || n.type === 'EXTERNAL') {
            var hasOutgoing = self.edges.some(function (e) { return e.from === n.id; });
            if (!hasOutgoing) {
                self.diagnostics.push({
                    code: 'S02',
                    level: 'info',
                    message: 'Узел "' + n.label + '" (' + n.id + ') не имеет исходящих связей. Он не влияет на результат.',
                    node: n.id
                });
            }
        }
    });

    self.edges.forEach(function (e) {
        if (e.type !== 'THR' && e.coefficient === null) {
            self.diagnostics.push({
                code: 'S06',
                level: 'warning',
                message: 'Ребро ' + e.from + ' \u2192 ' + e.to + ' (тип ' + e.type + ') не имеет коэффициента.',
                edge: e.from + '->' + e.to
            });
        }
        if (e.type === 'THR' && e.threshold === null) {
            self.diagnostics.push({
                code: 'S07',
                level: 'warning',
                message: 'Ребро ' + e.from + ' \u2192 ' + e.to + ' (тип THR): не задан порог (threshold).',
                edge: e.from + '->' + e.to
            });
        }
    });

    var expectedSigns = {
        'PRICE->VOLUME': 'negative',
        'COGS->NET_PROFIT': 'negative',
        'COGS->GROSS_PROFIT': 'negative',
        'COGS->EBITDA': 'negative',
        'OPEX->NET_PROFIT': 'negative',
        'INTEREST->EBT': 'negative',
        'TAX->NET_PROFIT': 'negative',
        'ATTRITION->HEADCOUNT': 'negative',
        'ADMIN_EXP->EBITDA': 'negative',
        'SELLING_EXP->EBITDA': 'negative',
        'DA->EBIT': 'negative',
        'MARKETING->VOLUME': 'positive',
        'REVENUE->NET_PROFIT': 'positive',
        'REVENUE->GROSS_PROFIT': 'positive',
        'REVENUE->EBITDA': 'positive'
    };
    self.edges.forEach(function (e) {
        var key = e.from + '->' + e.to;
        var expected = expectedSigns[key];
        if (expected && e.coefficient !== null) {
            var actualSign = e.coefficient > 0 ? 'positive' : (e.coefficient < 0 ? 'negative' : 'zero');
            if (actualSign !== 'zero' && actualSign !== expected) {
                self.diagnostics.push({
                    code: 'E01',
                    level: 'warning',
                    message: 'Ребро ' + key + ' имеет ' + (e.coefficient > 0 ? 'положительный' : 'отрицательный') +
                        ' коэффициент (' + e.coefficient.toFixed(2) + '). Обычно ожидается ' +
                        (expected === 'positive' ? 'положительный' : 'отрицательный') + '. Проверьте.',
                    edge: key
                });
            }
        }
    });

    var nonNegativeNodes = ['INVENTORY', 'CASH', 'FIXED_ASSETS', 'RECEIVABLES', 'HEADCOUNT', 'ADMIN_HEADCOUNT', 'PROD_HEADCOUNT'];
    nonNegativeNodes.forEach(function (nid) {
        var n = self.nodes[nid];
        if (n && n.value !== null && n.value < 0) {
            self.diagnostics.push({
                code: 'E05',
                level: 'warning',
                message: 'Узел "' + n.label + '" (' + n.id + ') принял отрицательное значение: ' + formatValue(n.value) + '. Это экономически некорректно.',
                node: n.id
            });
        }
    });

    var cashNode = self.nodes['CASH'];
    var fcfNode = self.nodes['FCF'];
    if (cashNode && fcfNode && cashNode.value !== null && fcfNode.value !== null) {
        if (fcfNode.value < 0 && cashNode.value > 0) {
            var dailyBurn = Math.abs(fcfNode.value) / 365;
            if (dailyBurn > 0) {
                var daysLeft = Math.floor(cashNode.value / dailyBurn);
                if (daysLeft < 30) {
                    self.diagnostics.push({
                        code: 'C01',
                        level: 'critical',
                        message: 'Дней до кассового разрыва: ' + daysLeft + '. При текущем темпе расходов денежные средства закончатся через ' + daysLeft + ' дн.',
                        node: 'CASH'
                    });
                }
            }
        }
    }

    var caNode = self.nodes['CURRENT_ASSETS'];
    var stdNode = self.nodes['STD'];
    var payNode = self.nodes['PAYABLES'];
    if (caNode && payNode && caNode.value !== null && payNode.value !== null) {
        var shortLiab = (stdNode && stdNode.value ? stdNode.value : 0) + (payNode.value || 0);
        if (shortLiab > 0) {
            var cr = caNode.value / shortLiab;
            if (cr < 1.0) {
                self.diagnostics.push({
                    code: 'C04',
                    level: 'critical',
                    message: 'Текущая ликвидность = ' + cr.toFixed(2) + '. Оборотных активов недостаточно для покрытия краткосрочных обязательств.',
                    node: 'CURRENT_ASSETS'
                });
            }
        }
    }

    var loansNode = self.nodes['LOANS'];
    var ebitdaNode = self.nodes['EBITDA'];
    if (loansNode && ebitdaNode && loansNode.value !== null && ebitdaNode.value !== null && ebitdaNode.value > 0) {
        var de = loansNode.value / ebitdaNode.value;
        if (de > 3.0) {
            self.diagnostics.push({
                code: 'C02',
                level: 'critical',
                message: 'Debt/EBITDA = ' + de.toFixed(1) + '. Превышен порог 3.0. Возможно нарушение ковенантов.',
                node: 'LOANS'
            });
        }
    }

    var ebitNode = self.nodes['EBIT'];
    var intNode = self.nodes['INTEREST'];
    if (ebitNode && intNode && ebitNode.value !== null && intNode.value !== null && intNode.value > 0) {
        var ic = ebitNode.value / intNode.value;
        if (ic < 2.0) {
            self.diagnostics.push({
                code: 'C03',
                level: 'critical',
                message: 'Покрытие процентов = ' + ic.toFixed(1) + '. Ниже порога 2.0. Риск дефолта по процентам.',
                node: 'INTEREST'
            });
        }
    }

    return self.diagnostics;
};

Graph.prototype.toDict = function () {
    var nodeList = [];
    var self = this;
    Object.keys(self.nodes).forEach(function (key) {
        nodeList.push(self.nodes[key].toDict());
    });
    var edgeList = self.edges.map(function (e) { return e.toDict(); });
    var constrList = self.constraints.map(function (c) {
        return { node: c.node, operator: c.operator, value: c.value };
    });
    return {
        project: { name: self.name, version: 2 },
        nodes: nodeList,
        edges: edgeList,
        constraints: constrList
    };
};

Graph.fromDict = function (data) {
    var g = new Graph(data.project.name);
    (data.nodes || []).forEach(function (n) { g.addNode(Node.fromDict(n)); });
    (data.edges || []).forEach(function (e) { g.addEdge(Edge.fromDict(e)); });
    (data.constraints || []).forEach(function (c) { g.addConstraint(new Constraint(c.node, c.operator, c.value)); });
    return g;
};

// ============================================================
// ПАРСЕР YAML
// ============================================================

function parseYAML(text) {
    var lines = text.split('\n');
    var result = { project: { name: '', version: 1 }, nodes: [], edges: [], constraints: [] };
    var currentSection = null;
    var currentNode = null;
    var currentEdge = null;
    var currentConstraint = null;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.trim() === '' || line.trim().indexOf('#') === 0) continue;
        if (line.indexOf('project:') === 0) { currentSection = 'project'; continue; }
        if (line.indexOf('nodes:') === 0) { currentSection = 'nodes'; continue; }
        if (line.indexOf('edges:') === 0) { currentSection = 'edges'; continue; }
        if (line.indexOf('constraints:') === 0) { currentSection = 'constraints'; continue; }

        var indent = line.search(/\S/);

        if (currentSection === 'project') {
            if (indent === 2 && line.indexOf('name:') >= 0) {
                result.project.name = line.split('name:')[1].trim().replace(/"/g, '');
            }
        }

        if (currentSection === 'nodes') {
            if (indent === 2 && line.indexOf('- id:') >= 0) {
                currentNode = { id: line.split('id:')[1].trim() };
                result.nodes.push(currentNode);
            } else if (indent === 4 && currentNode) {
                var kv = line.split(':');
                var key = kv[0].trim();
                var val = kv.slice(1).join(':').trim();
                if (key === 'value' || key === 'min' || key === 'max') {
                    var num = parseFloat(val);
                    currentNode[key] = isNaN(num) ? val : num;
                } else if (key === 'enabled') {
                    currentNode[key] = val === 'true' || val === 'True';
                } else {
                    currentNode[key] = val;
                }
            }
        }

        if (currentSection === 'edges') {
            if (indent === 2 && line.indexOf('- from:') >= 0) {
                currentEdge = { from: line.split('from:')[1].trim() };
                result.edges.push(currentEdge);
            } else if (indent === 4 && currentEdge) {
                var kv2 = line.split(':');
                var key2 = kv2[0].trim();
                var val2 = kv2.slice(1).join(':').trim();
                var num2 = parseFloat(val2);
                currentEdge[key2] = isNaN(num2) ? val2 : num2;
            }
        }

        if (currentSection === 'constraints') {
            if (indent === 2 && line.indexOf('- node:') >= 0) {
                currentConstraint = { node: line.split('node:')[1].trim() };
                result.constraints.push(currentConstraint);
            } else if (indent === 4 && currentConstraint) {
                var kv3 = line.split(':');
                var key3 = kv3[0].trim();
                var val3 = kv3.slice(1).join(':').trim();
                var num3 = parseFloat(val3);
                currentConstraint[key3] = isNaN(num3) ? val3 : num3;
            }
        }
    }
    return result;
}

function toYAML(graph) {
    var dict = graph.toDict();
    var y = 'project:\n  name: "' + dict.project.name + '"\n  version: 2\n\nnodes:\n';
    dict.nodes.forEach(function (n) {
        y += '  - id: ' + n.id + '\n';
        y += '    type: ' + n.type + '\n';
        y += '    label: "' + n.label + '"\n';
        if (n.temporalType && n.temporalType !== 'CONSTANT') y += '    temporalType: ' + n.temporalType + '\n';
        if (n.value !== undefined && n.value !== null) y += '    value: ' + n.value + '\n';
        if (n.min !== undefined && n.min !== null) y += '    min: ' + n.min + '\n';
        if (n.max !== undefined && n.max !== null) y += '    max: ' + n.max + '\n';
        y += '    source: ' + n.source + '\n';
        y += '    enabled: ' + n.enabled + '\n';
    });
    y += '\nedges:\n';
    dict.edges.forEach(function (e) {
        y += '  - from: ' + e.from + '\n    to: ' + e.to + '\n    type: ' + e.type + '\n';
        if (e.coefficient !== undefined && e.coefficient !== null) y += '    coefficient: ' + e.coefficient + '\n';
        if (e.lag_days) y += '    lag_days: ' + e.lag_days + '\n';
        if (e.threshold !== undefined && e.threshold !== null) y += '    threshold: ' + e.threshold + '\n';
    });
    if (dict.constraints && dict.constraints.length > 0) {
        y += '\nconstraints:\n';
        dict.constraints.forEach(function (c) {
            y += '  - node: ' + c.node + '\n    operator: "' + c.operator + '"\n    value: ' + c.value + '\n';
        });
    }
    return y;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function formatValue(v) {
    if (v === null || v === undefined) return '\u2014';
    if (typeof v === 'number') {
        if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(2) + 'M';
        if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'K';
        return v.toFixed(0);
    }
    return String(v);
}

function formatInputValue(v) {
    if (v === null || v === undefined || v === '') return '';
    var num = parseFloat(v);
    if (isNaN(num)) return v;
    return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function unformatInputValue(str) {
    if (!str) return '';
    return str.replace(/\s/g, '').replace(',', '.');
}

function checkConstraint(constraint, node) {
    var op = constraint.operator;
    var target = constraint.value;
    var actual = node.value;
    if (actual === null || actual === undefined) return null;
    switch (op) {
        case '>=': return actual >= target;
        case '<=': return actual <= target;
        case '==': return actual === target;
        case '>': return actual > target;
        case '<': return actual < target;
        default: return null;
    }
}
