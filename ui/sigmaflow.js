/**
 * SIGMAFLOW — Ядро системы на JavaScript
 * Классы: Node, Edge, Constraint, Graph
 * Функции: computeEdge, parseYAML, toYAML
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
                return above !== undefined ? above : inputValue;
            } else {
                return below !== undefined ? below : 0;
            }

        default:
            throw new Error('Неизвестный тип связи: ' + edgeType);
    }
}

// ============================================================
// КЛАССЫ МОДЕЛИ
// ============================================================

class Node {
    constructor(id, type, value, min, max, source) {
        this.id = id;
        this.type = type;
        this.value = value !== undefined ? value : null;
        this.min = min !== undefined ? min : null;
        this.max = max !== undefined ? max : null;
        this.source = source || 'manual';
    }

    static fromDict(data) {
        return new Node(
            data.id,
            data.type,
            data.value,
            data.min,
            data.max,
            data.source
        );
    }

    toDict() {
        var result = {
            id: this.id,
            type: this.type,
            source: this.source
        };
        if (this.value !== null) result.value = this.value;
        if (this.min !== null) result.min = this.min;
        if (this.max !== null) result.max = this.max;
        return result;
    }
}

class Edge {
    constructor(fromNode, toNode, type, coefficient, lagDays, threshold, above, below) {
        this.from = fromNode;
        this.to = toNode;
        this.type = type || 'LIN';
        this.coefficient = coefficient !== undefined ? coefficient : null;
        this.lag_days = lagDays || 0;
        this.threshold = threshold !== undefined ? threshold : null;
        this.above = above !== undefined ? above : null;
        this.below = below !== undefined ? below : null;
    }

    static fromDict(data) {
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
    }

    toDict() {
        var result = { from: this.from, to: this.to, type: this.type };
        if (this.coefficient !== null) result.coefficient = this.coefficient;
        if (this.lag_days) result.lag_days = this.lag_days;
        if (this.threshold !== null) result.threshold = this.threshold;
        if (this.above !== null) result.above = this.above;
        if (this.below !== null) result.below = this.below;
        return result;
    }
}

class Constraint {
    constructor(node, operator, value) {
        this.node = node;
        this.operator = operator;
        this.value = value;
    }
}

class Graph {
    constructor(name) {
        this.name = name || '';
        this.nodes = {};
        this.edges = [];
        this.constraints = [];
    }

    addNode(node) {
        this.nodes[node.id] = node;
    }

    addEdge(edge) {
        this.edges.push(edge);
    }

    addConstraint(constraint) {
        this.constraints.push(constraint);
    }

    compute() {
        // Сброс вычисляемых узлов
        var self = this;
        Object.keys(self.nodes).forEach(function(key) {
            var node = self.nodes[key];
            if (node.type === 'INTERMEDIATE' || node.type === 'TARGET') {
                node.value = 0;
            }
        });

        // Суммируем вклады по рёбрам
        self.edges.forEach(function(edge) {
            var fromNode = self.nodes[edge.from];
            var toNode = self.nodes[edge.to];

            if (!fromNode || !toNode) return;
            if (fromNode.value === null || fromNode.value === undefined) return;
            if (toNode.type !== 'INTERMEDIATE' && toNode.type !== 'TARGET') return;

            var coeff = edge.coefficient !== null ? edge.coefficient : 1.0;
            var contribution = computeEdge(
                edge.type,
                coeff,
                fromNode.value,
                edge.threshold,
                edge.above,
                edge.below
            );

            toNode.value = (toNode.value || 0) + contribution;
        });
    }

    static fromDict(data) {
        var g = new Graph(data.project.name);

        (data.nodes || []).forEach(function(n) {
            g.addNode(Node.fromDict(n));
        });

        (data.edges || []).forEach(function(e) {
            g.addEdge(Edge.fromDict(e));
        });

        (data.constraints || []).forEach(function(c) {
            g.addConstraint(new Constraint(c.node, c.operator, c.value));
        });

        return g;
    }

    toDict() {
        var nodeList = [];
        var self = this;
        Object.keys(self.nodes).forEach(function(key) {
            nodeList.push(self.nodes[key].toDict());
        });

        var edgeList = self.edges.map(function(e) { return e.toDict(); });

        var constraintList = self.constraints.map(function(c) {
            return { node: c.node, operator: c.operator, value: c.value };
        });

        return {
            project: { name: self.name, version: 1 },
            nodes: nodeList,
            edges: edgeList,
            constraints: constraintList
        };
    }
}

// ============================================================
// ПРОСТОЙ ПАРСЕР YAML (для демо-файла)
// ============================================================

function parseYAML(text) {
    var lines = text.split('\n');
    var result = {
        project: { name: '', version: 1 },
        nodes: [],
        edges: [],
        constraints: []
    };

    var currentSection = null;
    var currentNode = null;
    var currentEdge = null;
    var currentConstraint = null;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Пропуск пустых строк и комментариев
        if (line.trim() === '' || line.trim().indexOf('#') === 0) continue;

        // Секции
        if (line.indexOf('project:') === 0) {
            currentSection = 'project';
            continue;
        }
        if (line.indexOf('nodes:') === 0) {
            currentSection = 'nodes';
            continue;
        }
        if (line.indexOf('edges:') === 0) {
            currentSection = 'edges';
            continue;
        }
        if (line.indexOf('constraints:') === 0) {
            currentSection = 'constraints';
            continue;
        }

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

                if (key === 'value') {
                    var num = parseFloat(val);
                    currentNode[key] = isNaN(num) ? val : num;
                } else if (key === 'min' || key === 'max') {
                    var n = parseFloat(val);
                    currentNode[key] = isNaN(n) ? null : n;
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
    var yaml = 'project:\n';
    yaml += '  name: "' + dict.project.name + '"\n';
    yaml += '  version: 1\n\n';

    yaml += 'nodes:\n';
    dict.nodes.forEach(function(n) {
        yaml += '  - id: ' + n.id + '\n';
        yaml += '    type: ' + n.type + '\n';
        if (n.value !== undefined && n.value !== null) {
            yaml += '    value: ' + n.value + '\n';
        }
        if (n.min !== undefined && n.min !== null) {
            yaml += '    min: ' + n.min + '\n';
        }
        if (n.max !== undefined && n.max !== null) {
            yaml += '    max: ' + n.max + '\n';
        }
        yaml += '    source: ' + n.source + '\n';
    });

    yaml += '\nedges:\n';
    dict.edges.forEach(function(e) {
        yaml += '  - from: ' + e.from + '\n';
        yaml += '    to: ' + e.to + '\n';
        yaml += '    type: ' + e.type + '\n';
        if (e.coefficient !== undefined && e.coefficient !== null) {
            yaml += '    coefficient: ' + e.coefficient + '\n';
        }
        if (e.lag_days) {
            yaml += '    lag_days: ' + e.lag_days + '\n';
        }
    });

    if (dict.constraints && dict.constraints.length > 0) {
        yaml += '\nconstraints:\n';
        dict.constraints.forEach(function(c) {
            yaml += '  - node: ' + c.node + '\n';
            yaml += '    operator: "' + c.operator + '"\n';
            yaml += '    value: ' + c.value + '\n';
        });
    }

    return yaml;
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
        case '>':  return actual > target;
        case '<':  return actual < target;
        default:   return null;
    }
}
