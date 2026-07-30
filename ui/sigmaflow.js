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

    var totalActiveFA = 0;
    self.investments.forEach(function (inv) {
        // Учитываем только введённые в эксплуатацию (commissioning <= текущий месяц)
        var commMonth = inv.commissioning !== undefined ? inv.commissioning : inv.start;
        totalActiveFA += inv.cost || 0;
    });

    if (self.nodes['FIXED_ASSETS']) {
        var baseFA = self.nodes['FIXED_ASSETS_START'] ? self.nodes['FIXED_ASSETS_START'].value : (self.nodes['FIXED_ASSETS'].value || 0);
        // Не перезаписываем, если уже учтено
        // FIXED_ASSETS = база + все инвестиции
        self.nodes['FIXED_ASSETS'].value = baseFA + totalActiveFA;
    }
};

Graph.prototype.getMonthlyDA = function (startMonth, horizon) {
    var self = this;
    var daSch = [];
    for (var i = 0; i < horizon; i++) daSch.push(0);

    if (self.investments) {
        self.investments.forEach(function (inv) {
            var cost = inv.cost || 0;
            var daRate = self.nodes['DA_RATE'] ? self.nodes['DA_RATE'].value : 0.10;
            var monthlyDA = cost * daRate / 12;
            var commMonth = inv.commissioning !== undefined ? inv.commissioning : inv.start;

            // Амортизация с месяца, следующего за вводом
            var startIdx = commMonth - startMonth + 1;
            if (startIdx < 0) startIdx += 12;
            for (var j = startIdx; j < horizon; j++) {
                daSch[j] = (daSch[j] || 0) + monthlyDA;
            }
        });
    }

    // Добавляем амортизацию существующих ОС
    var baseFA = (self.nodes['FIXED_ASSETS_START'] ? self.nodes['FIXED_ASSETS_START'].value : 0)
        - (self.company ? (self.company.fa_start_da || 0) : 0);
    if (baseFA < 0) baseFA = 0;
    var baseDA = baseFA * (self.nodes['DA_RATE'] ? self.nodes['DA_RATE'].value : 0.10) / 12;
    var remainingMonths = self.company ? (self.company.fa_remaining_months || 60) : 60;
    for (var i = 0; i < horizon; i++) {
        if (i < remainingMonths) {
            daSch[i] = (daSch[i] || 0) + baseDA;
        }
    }

    return daSch;
};

Graph.prototype.checkCovenants = function () {
    var self = this;
    var warnings = [];
    if (!self.credits) return warnings;

    self.credits.forEach(function (cr) {
        (cr.covenants || []).forEach(function (cov) {
            var violated = false;
            var actual = 0;

            if (cov.type === 'debtEbitda') {
                var ebitda = self.nodes['EBITDA'] ? Math.abs(self.nodes['EBITDA'].value) : 0;
                actual = ebitda > 0 ? (cr.amount || 0) / ebitda : 999;
                violated = actual > cov.value;
            } else if (cov.type === 'icr') {
                var ebit = self.nodes['EBIT'] ? Math.abs(self.nodes['EBIT'].value) : 0;
                var interest = self.nodes['INTEREST'] ? Math.abs(self.nodes['INTEREST'].value) : 0;
                actual = interest > 0 ? ebit / interest : 0;
                violated = actual < cov.value;
            } else if (cov.type === 'currentRatio') {
                var ca = self.nodes['CURRENT_ASSETS'] ? Math.abs(self.nodes['CURRENT_ASSETS'].value) : 0;
                var cl = (self.nodes['PAYABLES'] ? Math.abs(self.nodes['PAYABLES'].value) : 0) + (self.nodes['LOANS'] ? Math.abs(self.nodes['LOANS'].value) : 0);
                actual = cl > 0 ? ca / cl : 0;
                violated = actual < cov.value;
            }

            if (violated) {
                warnings.push({ credit: cr.name, covenant: cov.type, threshold: cov.value, actual: actual.toFixed(1), violated: true });
            }
        });
    });
    return warnings;
};

Graph.prototype.checkCovenantsMonthly = function (startMonth, horizon) {
    var self = this;
    var result = [];
    if (!self.credits || self.credits.length === 0) return result;

    // Сохраняем текущие значения
    var saved = {};
    Object.keys(self.nodes).forEach(function (k) { saved[k] = self.nodes[k].value; });

    // Для каждого месяца
    for (var p = 0; p < horizon; p++) {
        var violations = [];

        self.credits.forEach(function (cr) {
            (cr.covenants || []).forEach(function (cov) {
                var actual = 0;
                var violated = false;

                if (cov.type === 'debtEbitda') {
                    var ebitda = self._val('EBITDA');
                    actual = ebitda > 0 ? (cr.amount || 0) / ebitda : 999;
                    violated = actual > cov.value;
                } else if (cov.type === 'icr') {
                    var ebit = self._val('EBIT');
                    var interest = self._val('INTEREST');
                    actual = interest > 0 ? ebit / interest : 0;
                    violated = actual < cov.value;
                } else if (cov.type === 'currentRatio') {
                    var ca = self._val('CURRENT_ASSETS');
                    var cl = self._val('PAYABLES') + self._val('LOANS');
                    actual = cl > 0 ? ca / cl : 0;
                    violated = actual < cov.value;
                } else if (cov.type === 'maxCapex') {
                    var capexY = self._val('CAPEX');
                    actual = capexY;
                    violated = actual > cov.value;
                } else if (cov.type === 'minRevenue') {
                    var rev = self._val('REVENUE');
                    actual = rev;
                    violated = actual < cov.value;
                }

                if (violated) {
                    violations.push({
                        credit: cr.name,
                        covenant: cov.type,
                        threshold: cov.value,
                        actual: actual
                    });
                }
            });
        });

        result.push({
            period: p,
            violations: violations,
            hasViolation: violations.length > 0
        });
    }

    // Восстанавливаем значения
    Object.keys(saved).forEach(function (k) { if (self.nodes[k]) self.nodes[k].value = saved[k]; });
    self.compute();

    return result;
};

Graph.prototype.checkBalance = function () {
    var self = this;
    var fixedAssets = self._val('FIXED_ASSETS');
    var currentAssets = self._val('CURRENT_ASSETS');
    var loans = self._val('LOANS');
    var payables = self._val('PAYABLES');
    var equity = self._val('EQUITY');
    var retained = self._val('RETAINED_EARNINGS');
    var assets = fixedAssets + currentAssets;
    var liabilities = loans + payables + equity + retained;
    var diff = assets - liabilities;
    var pct = assets > 0 ? Math.abs(diff) / assets * 100 : 0;
    return { assets: assets, liabilities: liabilities, diff: diff, pct: pct, balanced: pct < 1 };
};

Graph.prototype.auditInvariants = function () {
    var self = this;
    var results = [];

    function check(code, label, expected, actual, tolerance) {
        tolerance = tolerance || 0.01;
        var diff = Math.abs(expected - actual);
        var maxVal = Math.max(Math.abs(expected), Math.abs(actual), 1);
        var passed = diff / maxVal < tolerance;
        results.push({
            code: code,
            label: label,
            expected: expected,
            actual: actual,
            diff: diff,
            passed: passed
        });
    }

    // I01: REVENUE = VOLUME * PRICE * SEASON (если формула)
    var rev = self._valSigned('REVENUE');
    var vol = self._valSigned('VOLUME');
    var price = self._valSigned('PRICE');
    var season = self._valSigned('SEASON');
    if (rev && vol && price) {
        var expectedRev = vol * price * (season || 1);
        check('I01', 'REVENUE = VOLUME × PRICE × SEASON', expectedRev, rev);
    }

    // I02: GROSS_PROFIT = REVENUE - COGS
    var gp = self._valSigned('GROSS_PROFIT');
    var cogs = self._valSigned('COGS');
    if (gp && rev && cogs) {
        check('I02', 'GROSS_PROFIT = REVENUE − COGS', rev - cogs, gp);
    }

    // I03: EBITDA = GROSS_PROFIT - SELLING_EXP - ADMIN_EXP
    var ebitda = self._valSigned('EBITDA');
    var sell = self._valSigned('SELLING_EXP');
    var adm = self._valSigned('ADMIN_EXP');
    if (ebitda && gp && sell && adm) {
        check('I03', 'EBITDA = GP − SELLING − ADMIN', gp - sell - adm, ebitda);
    }

    // I04: EBIT = EBITDA - DA
    var ebit = self._valSigned('EBIT');
    var da = self._valSigned('DA');
    if (ebit && ebitda && da) {
        check('I04', 'EBIT = EBITDA − DA', ebitda - Math.abs(da), ebit);
    }

    // I05: NET_PROFIT = EBT - TAX
    var np = self._valSigned('NET_PROFIT');
    var ebt = self._valSigned('EBT');
    var tax = self._valSigned('TAX');
    if (np && ebt && tax) {
        check('I05', 'NET_PROFIT = EBT − TAX', ebt - tax, np);
    }

    // I06: CASH = CASH_START + FCF
    var cash = self._valSigned('CASH');
    var cashStart = self._valSigned('CASH_START');
    var fcf = self._valSigned('FCF');
    if (cash && cashStart && fcf) {
        check('I06', 'CASH = CASH_START + FCF', cashStart + fcf, cash);
    }

    // I07: FCF = CFO + CFI + CFF
    if (self.nodes['FCF'] && self.nodes['CFO'] && self.nodes['CFI'] && self.nodes['CFF']) {
        var fcf7 = self._valSigned('FCF');
        var cfo7 = self._valSigned('CFO');
        var cfi7 = self._valSigned('CFI');
        var cff7 = self._valSigned('CFF');
        check('I07', 'FCF = CFO + CFI + CFF', cfo7 + cfi7 + cff7, fcf7);
    }

    // I08: INTEREST = LOANS * LOAN_RATE (если формула)
    if (self.nodes['INTEREST'] && self.nodes['LOANS'] && self.nodes['LOAN_RATE'] && self.nodes['INTEREST'].formula) {
        var interest8 = self._valSigned('INTEREST');
        var loans8 = self._valSigned('LOANS');
        var loanRate8 = self._valSigned('LOAN_RATE');
        check('I08', 'INTEREST = LOANS × LOAN_RATE', loans8 * loanRate8, interest8);
    }

    // I09: DA = (FIXED_ASSETS + INTANGIBLE) * DA_RATE (если формула)
    if (self.nodes['DA'] && self.nodes['FIXED_ASSETS'] && self.nodes['INTANGIBLE_ASSETS'] && self.nodes['DA_RATE'] && self.nodes['DA'].formula) {
        var da9 = self._valSigned('DA');
        var fa9 = self._valSigned('FIXED_ASSETS');
        var ia9 = self._valSigned('INTANGIBLE_ASSETS');
        var daRate9 = self._valSigned('DA_RATE');
        check('I09', 'DA = (FIXED + INTANGIBLE) × DA_RATE', (fa9 + ia9) * daRate9, da9);
    }

    return results;
};

Graph.prototype.fuzzTest = function (iterations) {
    var self = this;
    iterations = iterations || 100;
    var results = { total: iterations, passed: 0, failed: 0, errors: [], avgTime: 0 };
    var totalTime = 0;

    // Сохраняем исходные значения
    var saved = {};
    Object.keys(self.nodes).forEach(function (k) { saved[k] = self.nodes[k].value; });

    for (var i = 0; i < iterations; i++) {
        // Случайно меняем INPUT и EXTERNAL узлы в пределах ±50%
        Object.keys(self.nodes).forEach(function (k) {
            var n = self.nodes[k];
            if ((n.type === 'INPUT' || n.type === 'EXTERNAL') && n.value !== null && n.value !== 0) {
                var factor = 0.5 + Math.random();
                n.value = saved[k] * factor;
            }
        });

        var start = Date.now();
        try {
            self.compute();
            results.passed++;
        } catch (e) {
            results.failed++;
            results.errors.push({ iteration: i, error: e.message });
        }
        totalTime += Date.now() - start;

        // Восстанавливаем значения
        Object.keys(saved).forEach(function (k) { self.nodes[k].value = saved[k]; });
    }

    results.avgTime = Math.round(totalTime / iterations * 100) / 100;
    self.compute();
    return results;
};

Graph.prototype.crossValidate = function () {
    var self = this;
    var startMonth = new Date().getMonth();
    var results = [];

    // Получаем данные из всех источников
    var pnl = self.getPnL(startMonth, 12);
    var cal = self.getCashFlowCalendar(startMonth, 12);

    if (!pnl || !cal) return results;

    var pnlMonth0 = pnl.rows[0];
    var calMonth0 = cal.periods[0];

    // Список показателей для сравнения
    var checks = [
        {
            label: 'Выручка', data: self._valSigned('REVENUE'), pnl: pnlMonth0.revenue, cal: calMonth0.revenue,
            note: calMonth0.revenue === 0 ? 'Отсрочка платежей' : null
        },
        { label: 'Себестоимость', data: Math.abs(self._valSigned('COGS')), pnl: Math.abs(pnlMonth0.cogs), cal: calMonth0.costs, note: null },
        { label: 'EBITDA', data: self._valSigned('EBITDA'), pnl: pnlMonth0.ebitda, cal: null, note: null },
        {
            label: 'EBIT', data: self._valSigned('EBIT'), pnl: pnlMonth0.ebit, cal: null,
            note: 'P&L считает налоги иначе'
        },
        {
            label: 'Чистая прибыль', data: self._valSigned('NET_PROFIT'), pnl: pnlMonth0.net, cal: null,
            note: 'P&L: налоги по кварталам, ДАННЫЕ: текущий узел'
        },
        { label: 'Проценты', data: Math.abs(self._valSigned('INTEREST')), pnl: Math.abs(pnlMonth0.interest), cal: calMonth0.interest, note: null },
        {
            label: 'Амортизация', data: Math.abs(self._valSigned('DA')), pnl: Math.abs(pnlMonth0.da), cal: calMonth0.da || 0,
            note: 'P&L: getMonthlyDA, ДАННЫЕ: годовая / 12'
        },
        {
            label: 'CAPEX', data: Math.abs(self._valSigned('CAPEX')), pnl: null, cal: calMonth0.capex,
            note: calMonth0.capex === 0 ? 'Платёж в другом месяце' : null
        },
        { label: 'ФОТ произв.', data: Math.abs(self._valSigned('DIRECT_LABOR')), pnl: null, cal: calMonth0.payrollProd, note: null },
        { label: 'ФОТ АУП', data: Math.abs(self._valSigned('ADMIN_PAYROLL')), pnl: null, cal: calMonth0.payrollAdm, note: null }
    ];

    checks.forEach(function (c) {
        var vals = [c.data, c.pnl, c.cal].filter(function (v) { return v !== null && v !== undefined; });
        if (vals.length < 2) return;

        var min = Math.min.apply(null, vals.map(Math.abs));
        var max = Math.max.apply(null, vals.map(Math.abs));
        var diff = max - min;
        var avg = (max + min) / 2;
        var pct = avg > 0 ? (diff / avg * 100) : 0;
        var passed = pct < 5;

        results.push({
            label: c.label,
            data: c.data,
            pnl: c.pnl,
            cal: c.cal,
            diff: diff,
            pct: pct.toFixed(1),
            passed: passed,
            note: c.note
        });
    });

    return results;
};

Graph.prototype.cascadeTest = function () {
    var self = this;
    var results = [];

    // Сохраняем исходные значения
    var saved = {};
    Object.keys(self.nodes).forEach(function (k) { saved[k] = self.nodes[k].value; });

    // Базовые значения
    self.compute();
    var baseValues = {};
    Object.keys(self.nodes).forEach(function (k) { baseValues[k] = self.nodes[k].value; });

    // Проверяем каждый INPUT и EXTERNAL узел
    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if (n.type !== 'INPUT' && n.type !== 'EXTERNAL') return;
        if (n.value === null || n.value === 0) return;
        if (n.enabled === false) return;

        // Восстанавливаем
        Object.keys(saved).forEach(function (k) { self.nodes[k].value = saved[k]; });

        // Меняем на +10%
        n.value = n.value * 1.1;
        self.compute();

        // Проверяем, какие узлы изменились
        var changedNodes = [];
        Object.keys(self.nodes).forEach(function (k) {
            if (k === key) return;
            var oldVal = baseValues[k];
            var newVal = self.nodes[k].value;
            if (oldVal === null || newVal === null) return;
            if (oldVal === 0 && newVal === 0) return;
            var change = oldVal !== 0 ? (newVal - oldVal) / Math.abs(oldVal) : (newVal !== 0 ? 1 : 0);
            if (Math.abs(change) > 0.001) {
                changedNodes.push({
                    node: k,
                    label: self.nodes[k].label || k,
                    oldVal: oldVal,
                    newVal: newVal,
                    change: change
                });
            }
        });

        results.push({
            inputNode: key,
            inputLabel: n.label || key,
            changedCount: changedNodes.length,
            changedNodes: changedNodes.slice(0, 5) // топ-5 изменений
        });
    });

    // Восстанавливаем
    Object.keys(saved).forEach(function (k) { self.nodes[k].value = saved[k]; });
    self.compute();

    // Сортируем по количеству изменённых узлов
    results.sort(function (a, b) { return b.changedCount - a.changedCount; });

    return results;
};

Graph.prototype.updateBalanceFromCredits = function () {
    var self = this;
    if (!self.credits || self.credits.length === 0) return; // не трогаем, если нет кредитов
    //

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

    // Узлы, которые нужно вычислять последними (финансовая цепочка)
    var lateNodes = ['TAX', 'EBT', 'EBIT', 'EBITDA', 'CFO', 'CFI', 'CFF', 'FCF', 'INTEREST', 'CASH'];

    // Шаг 1: вычисляем узлы с формулами, кроме lateNodes
    Object.keys(self.nodes).forEach(function (key) {
        if (lateNodes.indexOf(key) >= 0) return; // пропускаем, посчитаем позже
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

    // Шаг 4: вычисляем финансовую цепочку последней, в правильном порядке
    lateNodes.forEach(function (key) {
        var n = self.nodes[key];
        if (n && n.formula && n.enabled !== false) {
            try {
                n.value = self._evalFormula(n.formula);
            } catch (e) {
                n.value = 0;
            }
        }
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
    var season = self.company ? (self.company.season || [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]) : [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    var prepayPct = self._company('prepay_pct', 0) / 100;
    var prepayDays = self._company('prepay_days', 0);
    var prepayShare = self._company('prepay_share', 0) / 100;
    var receivablesDelay = Math.round(self._company('receivables_days', 30) / 30);

    var revenueReceived = [];
    for (var i = 0; i < horizon; i++) revenueReceived.push(0);

    for (var i = 0; i < horizon; i++) {
        var mo = (startMonth + i) % 12;
        var monthlyRev = revY * (season[mo] || 1);

        // Постоплата: деньги приходят с задержкой
        var postIdx = i + receivablesDelay;
        if (postIdx < horizon) {
            revenueReceived[postIdx] += monthlyRev * (1 - prepayShare);
        }

        // Предоплата: деньги приходят до отгрузки
        var prepayMonths = Math.round(prepayDays / 30);
        var preIdx = i - prepayMonths;
        if (preIdx >= 0 && preIdx < horizon) {
            revenueReceived[preIdx] += monthlyRev * prepayShare * prepayPct;
        }
        // Доплата после отгрузки (оставшаяся часть предоплаты)
        if (prepayPct < 1) {
            var postPreIdx = i + receivablesDelay;
            if (postPreIdx < horizon) {
                revenueReceived[postPreIdx] += monthlyRev * prepayShare * (1 - prepayPct);
            }
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
    var daSch = self.getMonthlyDA(startMonth, horizon);
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
        var da = -Math.abs(daSch[p]);
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

Graph.prototype.getMarginalEffects = function () {
    var self = this;
    var saved = {};
    Object.keys(self.nodes).forEach(function (key) { saved[key] = self.nodes[key].value; });

    self.compute();
    var baseProfit = self.nodes['NET_PROFIT'] ? self.nodes['NET_PROFIT'].value : 0;
    var baseRevenue = self.nodes['REVENUE'] ? Math.abs(self.nodes['REVENUE'].value) : 1;

    // Только реальные управленческие рычаги
    var allowedNodes = {};
    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if (n.type !== 'INPUT') return;
        if (n.enabled === false) return;
        if (n.value === null) return;
        var isZero = (n.value === 0);
        if (isZero && n.min === null && n.max === null) return;
        allowedNodes[key] = true;
    });

    // Исключаем то, что не управляется ползунком
    var excludeFromSliders = [
        'SEASON', 'FIXED_ASSETS', 'INTANGIBLE_ASSETS', 'DA_RATE',
        'CB_RATE', 'INFLATION', 'FX_RATE', 'PMI', 'CCI', 'HOUSEHOLD_INCOME',
        'LABOR_INDEX', 'GEO_INDEX', 'SANCTIONS', 'TARIFFS', 'SUPPLIER_RISK',
        'TAX_RATE', 'NDS_RATE', 'INSURANCE_RATE', 'PROPERTY_TAX_RATE', 'TRADE_FEE',
        'BANK_SPREAD', 'CREDIT_RATING', 'COMPETITION',
        'DEFECT_RATE', 'RETURN_RATE', 'ATTRITION', 'ENGAGEMENT',
        'CAPACITY', 'WEAR', 'CASH_START', 'RETAINED_START',
        'delta_RECEIVABLES', 'delta_PAYABLES', 'delta_INVENTORY',
        'INTEREST_INCOME', 'PENALTIES', 'DIVIDENDS', 'MARKETING'
    ];

    var effects = [];

    Object.keys(allowedNodes).forEach(function (key) {
        if (excludeFromSliders.indexOf(key) >= 0) return;
        if (typeof isNodeVisible === 'function' && !isNodeVisible(key)) return;
        var n = self.nodes[key];

        var delta = n.value * 0.05; // 5% изменение для реалистичности
        if (Math.abs(delta) < 1) delta = n.value > 0 ? 1 : -1;
        if (n.min !== null && n.value + delta < n.min) delta = n.min - n.value;
        if (n.max !== null && n.value + delta > n.max) delta = n.max - n.value;
        if (delta === 0) return;

        // Восстанавливаем ВСЕ значения
        Object.keys(saved).forEach(function (k) { self.nodes[k].value = saved[k]; });

        // Меняем узел и делаем ПОЛНЫЙ compute
        n.value = n.value + delta;
        self.compute();

        var newProfit = self.nodes['NET_PROFIT'] ? self.nodes['NET_PROFIT'].value : 0;
        var profitDelta = newProfit - baseProfit;
        var profitDelta10 = profitDelta * 2; // экстраполяция на +10%

        effects.push({
            node: key,
            label: n.label || key,
            type: n.type,
            currentValue: saved[key],
            min: n.min,
            max: n.max,
            step: Number.isInteger(saved[key]) ? 1 : (Math.abs(saved[key]) > 1000 ? Math.round(Math.abs(saved[key]) / 100) : 0.01),
            profitDelta: profitDelta,
            profitDelta10: profitDelta10,
            impactPct: baseRevenue !== 0 ? (Math.abs(profitDelta) / baseRevenue * 100).toFixed(1) : 0
        });
    });

    // Восстанавливаем модель
    Object.keys(saved).forEach(function (k) { self.nodes[k].value = saved[k]; });
    self.compute();

    effects.sort(function (a, b) { return Math.abs(b.profitDelta) - Math.abs(a.profitDelta); });
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
    if (n < 3) return null;
    var p = X[0].length;

    // XtX
    var XtX = [];
    for (var i = 0; i < p; i++) { XtX[i] = []; for (var j = 0; j < p; j++) { XtX[i][j] = 0; for (var k = 0; k < n; k++) XtX[i][j] += X[k][i] * X[k][j]; } }

    // Xty
    var Xty = [];
    for (var i = 0; i < p; i++) { Xty[i] = 0; for (var k = 0; k < n; k++) Xty[i] += X[k][i] * y[k]; }

    // Решение
    var beta = null;
    if (p === 2) {
        var inv = invert2x2(XtX);
        if (!inv) return null;
        beta = [inv[0][0] * Xty[0] + inv[0][1] * Xty[1], inv[1][0] * Xty[0] + inv[1][1] * Xty[1]];
    } else if (p === 1) {
        var xMean = mean(X.map(function (r) { return r[0]; }));
        var yMean = mean(y);
        var num = 0, den = 0;
        for (var i = 0; i < n; i++) { var dx = X[i][0] - xMean; num += dx * (y[i] - yMean); den += dx * dx; }
        if (den === 0) return null;
        beta = [yMean - (num / den) * xMean, num / den];
    } else { return null; }

    // R² и стандартная ошибка
    var yMean = mean(y);
    var ssRes = 0, ssTot = 0;
    var residuals = [];
    for (var i = 0; i < n; i++) {
        var pred = beta[0];
        for (var j = 1; j < p; j++) pred += beta[j] * X[i][j];
        var res = y[i] - pred;
        residuals.push(res);
        ssRes += res * res;
        ssTot += (y[i] - yMean) * (y[i] - yMean);
    }
    var r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Стандартная ошибка коэффициентов
    var mse = ssRes / (n - p); // mean squared error
    var se = [];
    if (p === 2) {
        var inv = invert2x2(XtX);
        if (inv) {
            se = [Math.sqrt(mse * Math.abs(inv[0][0])), Math.sqrt(mse * Math.abs(inv[1][1]))];
        }
    } else {
        se = [Math.sqrt(mse / n), Math.sqrt(mse / (den || 1))];
    }

    // t-статистика и p-value (аппроксимация)
    var tStats = [];
    var pValues = [];
    for (var j = 0; j < p; j++) {
        var t = se[j] > 0 ? Math.abs(beta[j]) / se[j] : 0;
        tStats.push(t);
        // Аппроксимация p-value через нормальное распределение
        var pVal = t > 0 ? 2 * (1 - normCDF(t, n - p)) : 1;
        pValues.push(Math.min(pVal, 1));
    }

    return { coefficients: beta, r2: r2, se: se, tStats: tStats, pValues: pValues, dataPoints: n };
}

function calculateVIF(data, excludeIndex) {
    var n = data.length;
    if (n < 3) return null;

    var p = data[0].length;
    var vifs = [];

    for (var i = 0; i < p; i++) {
        if (i === excludeIndex) { vifs.push(0); continue; }

        // Строим X без i-го столбца
        var X = [];
        var y = [];
        for (var k = 0; k < n; k++) {
            var row = [1];
            y.push(data[k][i]);
            for (var j = 0; j < p; j++) {
                if (j !== i) row.push(data[k][j]);
            }
            X.push(row);
        }

        var reg = linearRegression(X, y);
        if (reg && reg.r2 < 1) {
            vifs.push(1 / (1 - reg.r2));
        } else {
            vifs.push(999);
        }
    }

    return vifs;
}

// Нормальное распределение (аппроксимация)
function normCDF(x, df) {
    // Аппроксимация t-распределения Стьюдента через нормальное
    var z = x;
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x) {
    var sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
}

Graph.prototype.calibrate = function () {
    var self = this;
    var results = [];

    if (!self.history || self.history.length < 3) {
        return { error: 'Недостаточно данных. Нужно минимум 3 периода.' };
    }

    // Собираем все периоды с fact
    var allData = self.history.filter(function (h) {
        return h.fact && Object.keys(h.fact).length > 0;
    });

    if (allData.length < 3) {
        return { error: 'Недостаточно периодов с фактическими данными.' };
    }

    // Исключаем выбросы
    var outliers = self.detectOutliers();
    var excludedPeriods = [];
    outliers.forEach(function (o) {
        if (excludedPeriods.indexOf(o.period) === -1) {
            excludedPeriods.push(o.period);
        }
    });

    var cleanData = allData.filter(function (h) {
        return excludedPeriods.indexOf(h.period) === -1;
    });

    if (cleanData.length < 3) {
        return { error: 'После исключения выбросов осталось менее 3 периодов.' };
    }

    // Экономически осмысленные пары для калибровки
    var meaningfulPairs = [
        { from: 'PRICE', to: 'VOLUME', expectedSign: 'negative' },
        { from: 'MARKETING', to: 'VOLUME', expectedSign: 'positive' },
        { from: 'VOLUME', to: 'REVENUE', expectedSign: 'positive' },
        { from: 'REVENUE', to: 'NET_PROFIT', expectedSign: 'positive' },
        { from: 'COGS', to: 'NET_PROFIT', expectedSign: 'negative' },
        { from: 'REVENUE', to: 'EBITDA', expectedSign: 'positive' },
        { from: 'COGS', to: 'EBITDA', expectedSign: 'negative' },
        { from: 'OPEX', to: 'NET_PROFIT', expectedSign: 'negative' },
        { from: 'INTEREST', to: 'EBT', expectedSign: 'negative' },
        { from: 'MARKETING', to: 'REVENUE', expectedSign: 'positive' },
        { from: 'HEADCOUNT', to: 'COGS', expectedSign: 'positive' },
        { from: 'AVG_SALARY', to: 'COGS', expectedSign: 'positive' }
    ];

    // Для каждой осмысленной пары, где оба узла есть в данных
    meaningfulPairs.forEach(function (pair) {
        var xData = [];
        var yData = [];
        var periods = [];

        cleanData.forEach(function (h) {
            var x = h.fact[pair.from];
            var y = h.fact[pair.to];
            if (x !== undefined && x !== null && y !== undefined && y !== null && x !== 0) {
                xData.push(x);
                yData.push(y);
                periods.push(h.period);
            }
        });

        if (xData.length < 3) return;

        // Строим регрессию
        var X = xData.map(function (x) { return [1, x]; });
        var reg = linearRegression(X, yData);
        if (!reg) return;

        var newCoeff = reg.coefficients[1];
        var oldCoeff = 0;

        // Ищем существующее ребро
        self.edges.forEach(function (edge) {
            if (edge.from === pair.from && edge.to === pair.to) {
                oldCoeff = edge.coefficient || 0;
            }
        });

        // Проверка знака
        var actualSign = newCoeff > 0 ? 'positive' : (newCoeff < 0 ? 'negative' : 'zero');
        var signOk = !pair.expectedSign || pair.expectedSign === actualSign;

        // SE и p-value
        var se = reg.se ? reg.se[1] : null;
        var pValue = reg.pValues ? reg.pValues[1] : null;

        results.push({
            from: pair.from,
            to: pair.to,
            oldCoefficient: oldCoeff,
            newCoefficient: Math.round(newCoeff * 10000) / 10000,
            r2: Math.round(reg.r2 * 100) / 100,
            dataPoints: xData.length,
            se: se !== null ? Math.round(se * 10000) / 10000 : null,
            pValue: pValue !== null ? Math.round(pValue * 1000) / 1000 : null,
            signOk: signOk,
            actualSign: actualSign,
            outlierCount: outliers.length,
            excludedPeriods: excludedPeriods
        });
    });

    results.sort(function (a, b) { return b.r2 - a.r2; });
    return { results: results, totalOutliers: outliers.length, excludedPeriods: excludedPeriods };
};

Graph.prototype.detectOutliers = function () {
    var self = this;
    var outliers = [];

    if (!self.history) return outliers;

    var historicalData = self.history.filter(function (h) { return h.type === 'historical' && h.fact; });
    if (historicalData.length < 5) return outliers;

    Object.keys(self.nodes).forEach(function (nodeId) {
        var values = [];
        historicalData.forEach(function (h) {
            if (h.fact[nodeId] !== undefined) {
                values.push({ period: h.period, value: h.fact[nodeId] });
            }
        });

        if (values.length < 5) return;

        var sorted = values.map(function (v) { return v.value; }).sort(function (a, b) { return a - b; });
        var q1 = sorted[Math.floor(sorted.length * 0.25)];
        var q3 = sorted[Math.floor(sorted.length * 0.75)];
        var iqr = q3 - q1;
        var lower = q1 - 1.5 * iqr;
        var upper = q3 + 1.5 * iqr;

        values.forEach(function (v) {
            if (v.value < lower || v.value > upper) {
                outliers.push({
                    node: nodeId,
                    label: self.nodes[nodeId] ? self.nodes[nodeId].label : nodeId,
                    period: v.period,
                    value: v.value,
                    lower: lower,
                    upper: upper
                });
            }
        });
    });

    return outliers;
};

Graph.prototype.findMissingPeriods = function () {
    var self = this;
    var missing = [];

    if (!self.history || self.history.length < 2) return missing;

    var periods = self.history.map(function (h) { return h.period; }).sort();

    for (var i = 1; i < periods.length; i++) {
        var prev = new Date(periods[i - 1] + '-01');
        var curr = new Date(periods[i] + '-01');
        var expectedMonth = new Date(prev);
        expectedMonth.setMonth(expectedMonth.getMonth() + 1);

        var expected = expectedMonth.toISOString().substring(0, 7);
        if (expected !== curr.toISOString().substring(0, 7)) {
            missing.push({ from: periods[i - 1], to: periods[i] });
        }
    }

    return missing;
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

Graph.prototype._valSigned = function (id) {
    var n = this.nodes[id];
    return n && n.value !== null && n.value !== undefined ? n.value : 0;
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

    // S01: INTERMEDIATE/TARGET без входящих связей И без формулы
    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if ((n.type === 'INTERMEDIATE' || n.type === 'TARGET') && !n.formula) {
            var hasIncoming = self.edges.some(function (e) { return e.to === n.id; });
            if (!hasIncoming) {
                self.diagnostics.push({
                    code: 'S01',
                    level: 'warning',
                    message: 'Узел "' + n.label + '" (' + n.id + ') не имеет входящих связей или формулы.',
                    node: n.id
                });
            }
        }
    });

    // S02: INPUT/EXTERNAL без исходящих связей
    Object.keys(self.nodes).forEach(function (key) {
        var n = self.nodes[key];
        if (n.type === 'INPUT' || n.type === 'EXTERNAL') {
            var hasOutgoing = self.edges.some(function (e) { return e.from === n.id; });
            var usedInFormula = false;
            Object.keys(self.nodes).forEach(function (k) {
                if (self.nodes[k].formula && self.nodes[k].formula.indexOf(n.id) >= 0) {
                    usedInFormula = true;
                }
            });
            if (!hasOutgoing && !usedInFormula) {
                self.diagnostics.push({
                    code: 'S02',
                    level: 'info',
                    message: 'Узел "' + n.label + '" (' + n.id + ') не имеет исходящих связей и не используется в формулах.',
                    node: n.id
                });
            }
        }
    });

    // C01: Кассовый разрыв
    var cashNode = self.nodes['CASH'];
    if (cashNode && cashNode.value !== null && cashNode.value < 0) {
        self.diagnostics.push({
            code: 'C01',
            level: 'critical',
            message: 'Отрицательный остаток денежных средств (' + formatValue(cashNode.value) + '). Кассовый разрыв!',
            node: 'CASH'
        });
    }

    // C02: Debt/EBITDA
    var loansNode = self.nodes['LOANS'];
    var ebitdaNode = self.nodes['EBITDA'];
    if (loansNode && ebitdaNode && loansNode.value > 0 && ebitdaNode.value !== 0) {
        var de = Math.abs(loansNode.value / ebitdaNode.value);
        if (de > 3.0) {
            self.diagnostics.push({
                code: 'C02',
                level: 'critical',
                message: 'Debt/EBITDA = ' + de.toFixed(1) + '. Превышен порог 3.0.',
                node: 'LOANS'
            });
        }
    }

    // C03: Interest Coverage
    var ebitNode = self.nodes['EBIT'];
    var intNode = self.nodes['INTEREST'];
    if (ebitNode && intNode && ebitNode.value !== 0 && intNode.value !== 0) {
        var ic = Math.abs(ebitNode.value / intNode.value);
        if (ic < 2.0) {
            self.diagnostics.push({
                code: 'C03',
                level: 'critical',
                message: 'Покрытие процентов = ' + ic.toFixed(1) + '. Ниже порога 2.0.',
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
    var num = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    if (isNaN(num)) return v;
    if (num === 0) return '0';
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
