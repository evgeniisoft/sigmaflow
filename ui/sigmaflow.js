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
    var periods = horizon;

    var cashStartNode = self.nodes['CASH_START'];
    var startCash = cashStartNode ? (cashStartNode.value || 0) : 5000000;

    var revenueNode = self.nodes['REVENUE'];
    var cogsNode = self.nodes['COGS'];
    var adminExpNode = self.nodes['ADMIN_EXP'];
    var sellingExpNode = self.nodes['SELLING_EXP'];
    var interestNode = self.nodes['INTEREST'];
    var interestIncomeNode = self.nodes['INTEREST_INCOME'];
    var otherIncNode = self.nodes['OTHER_INCOME'];
    var otherExpNode = self.nodes['OTHER_EXP'];
    var penaltiesNode = self.nodes['PENALTIES'];
    var loanRepaymentNode = self.nodes['LOAN_REPAYMENT'];
    var newLoansNode = self.nodes['NEW_LOANS'];
    var capexNode = self.nodes['CAPEX'];
    var dividendsNode = self.nodes['DIVIDENDS'];

    // Налоговые узлы
    var taxRateNode = self.nodes['TAX_RATE'];
    var ebtNode = self.nodes['EBT'];

    var months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    var calendar = [];
    var runningCash = startCash;

    var totalRevenue = 0;
    var totalCosts = 0;
    var totalTax = 0;
    var totalInterest = 0;
    var totalInterestIncome = 0;
    var totalOtherInc = 0;
    var totalOtherExp = 0;
    var totalPenalties = 0;
    var totalLoanRepayment = 0;
    var totalNewLoans = 0;
    var totalCapex = 0;
    var totalDividends = 0;

    // Годовая прибыль для расчёта налога на прибыль
    var annualEBT = ebtNode ? (ebtNode.value || 0) : 0;
    var taxRate = taxRateNode ? (taxRateNode.value || 0.20) : 0.20;
    var annualTax = Math.abs(annualEBT) * taxRate;
    var quarterlyTax = annualTax / 4;

    // Годовые значения (для равномерного распределения)
    var monthlyRevenue = revenueNode ? (revenueNode.value || 0) : 0;
    var monthlyCOGS = cogsNode ? (Math.abs(cogsNode.value) || 0) : 0;
    var monthlyAdmin = adminExpNode ? (Math.abs(adminExpNode.value) || 0) : 0;
    var monthlySelling = sellingExpNode ? (Math.abs(sellingExpNode.value) || 0) : 0;
    var monthlyCosts = monthlyCOGS + monthlyAdmin + monthlySelling;
    var monthlyInterest = interestNode ? (Math.abs(interestNode.value) || 0) : 0;
    var monthlyInterestIncome = interestIncomeNode ? (Math.abs(interestIncomeNode.value) || 0) : 0;
    var monthlyOtherInc = otherIncNode ? (Math.abs(otherIncNode.value) || 0) : 0;
    var monthlyOtherExp = otherExpNode ? (Math.abs(otherExpNode.value) || 0) : 0;
    var monthlyPenalties = penaltiesNode ? (Math.abs(penaltiesNode.value) || 0) : 0;
    var monthlyLoanRepayment = loanRepaymentNode ? (Math.abs(loanRepaymentNode.value) || 0) : 0;
    var monthlyNewLoans = newLoansNode ? (Math.abs(newLoansNode.value) || 0) : 0;
    var monthlyCapex = capexNode ? (Math.abs(capexNode.value) || 0) : 0;
    var monthlyDividends = dividendsNode ? (Math.abs(dividendsNode.value) || 0) : 0;

    // НДС (квартальный) — уплата равными долями в месяцах, следующих за кварталом
    var hasNDS = true;
    var ndsRate = 0.20;
    var monthlyRevenueForNDS = revenueNode ? (Math.abs(revenueNode.value) || 0) : 0;
    var monthlyNDS = monthlyRevenueForNDS * ndsRate / (1 + ndsRate);
    var quarterlyNDS = monthlyNDS * 3;
    var ndsMonthlyPayment = quarterlyNDS / 3;

    // Страховые взносы (ежемесячно)
    var adminPayrollNode = self.nodes['ADMIN_PAYROLL'];
    var directLaborNode = self.nodes['DIRECT_LABOR'];
    var totalPayroll = 0;
    if (adminPayrollNode && adminPayrollNode.value) totalPayroll += Math.abs(adminPayrollNode.value);
    if (directLaborNode && directLaborNode.value) totalPayroll += Math.abs(directLaborNode.value);
    var insuranceRate = 0.30;
    var monthlyInsurance = totalPayroll * insuranceRate;

    // НДФЛ (ежемесячно)
    var ndflRate = 0.13;
    var monthlyNDFL = totalPayroll * ndflRate;

    for (var p = 0; p < periods; p++) {
        var actualMonth = (startMonth + p) % 12;
        var year = 2026 + Math.floor((startMonth + p) / 12);
        var label = months[actualMonth] + ' ' + year;

        // Налог на прибыль — квартальные авансы
        var quarterMonth = actualMonth % 3;
        var isQuarterEnd = (quarterMonth === 2);
        var profitTaxThisMonth = 0;
        if (actualMonth === 2) profitTaxThisMonth = quarterlyTax;  // Март — аванс за 4 кв пред года
        if (actualMonth === 3) profitTaxThisMonth = quarterlyTax;  // Апрель — аванс за 1 кв
        if (actualMonth === 6) profitTaxThisMonth = quarterlyTax;  // Июль — аванс за 2 кв
        if (actualMonth === 9) profitTaxThisMonth = quarterlyTax;  // Октябрь — аванс за 3 кв

        // НДС — уплата в месяцах после квартала
        var ndsThisMonth = 0;
        if (hasNDS) {
            if (actualMonth === 3 || actualMonth === 4 || actualMonth === 5) ndsThisMonth = ndsMonthlyPayment;
            if (actualMonth === 6 || actualMonth === 7 || actualMonth === 8) ndsThisMonth = ndsMonthlyPayment;
            if (actualMonth === 9 || actualMonth === 10 || actualMonth === 11) ndsThisMonth = ndsMonthlyPayment;
            if (actualMonth === 0 || actualMonth === 1 || actualMonth === 2) ndsThisMonth = ndsMonthlyPayment;
        }

        var totalTaxThisMonth = profitTaxThisMonth + monthlyInsurance + monthlyNDFL + ndsThisMonth;

        // Итоговый поток
        var totalInflow = monthlyRevenue + monthlyInterestIncome + monthlyOtherInc + monthlyNewLoans;
        var totalOutflow = monthlyCosts + totalTaxThisMonth + monthlyInterest + monthlyOtherExp + monthlyPenalties + monthlyLoanRepayment + monthlyCapex + monthlyDividends;
        var netFlow = totalInflow - totalOutflow;

        var startCashPeriod = runningCash;
        runningCash += netFlow;

        calendar.push({
            period: p,
            label: label,
            month: actualMonth,
            startCash: startCashPeriod,
            revenue: monthlyRevenue,
            costs: monthlyCosts,
            profitTax: profitTaxThisMonth,
            nds: ndsThisMonth,
            insurance: monthlyInsurance,
            ndfl: monthlyNDFL,
            totalTax: totalTaxThisMonth,
            interest: monthlyInterest,
            interestIncome: monthlyInterestIncome,
            otherIncome: monthlyOtherInc,
            otherExp: monthlyOtherExp,
            penalties: monthlyPenalties,
            newLoans: monthlyNewLoans,
            loanRepayment: monthlyLoanRepayment,
            capex: monthlyCapex,
            dividends: monthlyDividends,
            netFlow: netFlow,
            endCash: runningCash,
            isGap: runningCash < 0,
            isWarning: netFlow < 0 && runningCash >= 0
        });

        totalRevenue += monthlyRevenue;
        totalCosts += monthlyCosts;
        totalTax += totalTaxThisMonth;
        totalInterest += monthlyInterest;
        totalInterestIncome += monthlyInterestIncome;
        totalOtherInc += monthlyOtherInc;
        totalOtherExp += monthlyOtherExp;
        totalPenalties += monthlyPenalties;
        totalLoanRepayment += monthlyLoanRepayment;
        totalNewLoans += monthlyNewLoans;
        totalCapex += monthlyCapex;
        totalDividends += monthlyDividends;
    }

    return {
        periods: calendar,
        startMonth: startMonth,
        totalRevenue: totalRevenue,
        totalCosts: totalCosts,
        totalTax: totalTax,
        totalInterest: totalInterest,
        totalInterestIncome: totalInterestIncome,
        totalOtherInc: totalOtherInc,
        totalOtherExp: totalOtherExp,
        totalPenalties: totalPenalties,
        totalLoanRepayment: totalLoanRepayment,
        totalNewLoans: totalNewLoans,
        totalCapex: totalCapex,
        totalDividends: totalDividends,
        endCash: runningCash,
        gapCount: calendar.filter(function (p) { return p.isGap; }).length,
        warningCount: calendar.filter(function (p) { return p.isWarning; }).length
    };
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
        'OPEX->NET_PROFIT': 'negative',
        'INTEREST->EBT': 'negative',
        'TAX->NET_PROFIT': 'negative',
        'ATTRITION->HEADCOUNT': 'negative',
        'MARKETING->VOLUME': 'positive',
        'REVENUE->NET_PROFIT': 'positive',
        'REVENUE->GROSS_PROFIT': 'positive'
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
