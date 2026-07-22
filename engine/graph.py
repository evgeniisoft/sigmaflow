"""
Базовые классы для хранения модели SigmaFlow.
Node, Edge, Constraint, Graph.
"""

class Node:
    """
    Узел графа факторов.
    """
    VALID_TYPES = ("INPUT", "INTERMEDIATE", "TARGET", "EXTERNAL")

    def __init__(self, id: str, type: str, value=None,
                 min=None, max=None, source="manual"):
        if type not in self.VALID_TYPES:
            raise ValueError(
                f"Недопустимый тип узла: {type}. "
                f"Допустимые: {self.VALID_TYPES}"
            )
        self.id = id
        self.type = type
        self.value = value
        self.min = min
        self.max = max
        self.source = source

    def to_dict(self):
        result = {
            "id": self.id,
            "type": self.type,
            "source": self.source
        }
        if self.value is not None:
            result["value"] = self.value
        if self.min is not None:
            result["min"] = self.min
        if self.max is not None:
            result["max"] = self.max
        return result

    @classmethod
    def from_dict(cls, data):
        return cls(**data)


class Edge:
    """
    Ребро графа (причинно-следственная связь).
    """
    VALID_TYPES = ("LIN", "LOG", "EXP", "THR", "DIM")

    def __init__(self, from_node: str, to_node: str,
                 type: str = "LIN", coefficient=None,
                 lag_days=0, threshold=None,
                 above=None, below=None):
        if type not in self.VALID_TYPES:
            raise ValueError(
                f"Недопустимый тип связи: {type}. "
                f"Допустимые: {self.VALID_TYPES}"
            )
        self.from_node = from_node
        self.to_node = to_node
        self.type = type
        self.coefficient = coefficient
        self.lag_days = lag_days
        self.threshold = threshold
        self.above = above
        self.below = below

    def to_dict(self):
        result = {
            "from": self.from_node,
            "to": self.to_node,
            "type": self.type
        }
        if self.coefficient is not None:
            result["coefficient"] = self.coefficient
        if self.lag_days:
            result["lag_days"] = self.lag_days
        if self.threshold is not None:
            result["threshold"] = self.threshold
        if self.above is not None:
            result["above"] = self.above
        if self.below is not None:
            result["below"] = self.below
        return result

    @classmethod
    def from_dict(cls, data):
        return cls(**data)


class Constraint:
    """
    Ограничение модели.
    """
    VALID_OPERATORS = (">=", "<=", "==", ">", "<")

    def __init__(self, node: str, operator: str, value):
        if operator not in self.VALID_OPERATORS:
            raise ValueError(
                f"Недопустимый оператор: {operator}. "
                f"Допустимые: {self.VALID_OPERATORS}"
            )
        self.node = node
        self.operator = operator
        self.value = value

    def to_dict(self):
        return {
            "node": self.node,
            "operator": self.operator,
            "value": self.value
        }


class Graph:
    """
    Полный граф модели компании.
    """
    def __init__(self, name=""):
        self.name = name
        self.nodes = {}
        self.edges = []
        self.constraints = []

    def add_node(self, node: Node):
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        self.edges.append(edge)

    def add_constraint(self, constraint: Constraint):
        self.constraints.append(constraint)

    def to_dict(self):
        return {
            "project": {
                "name": self.name,
                "version": 1
            },
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges],
            "constraints": [c.to_dict() for c in self.constraints]
        }

    @classmethod
    def from_dict(cls, data):
        g = cls(data["project"]["name"])
        for n in data.get("nodes", []):
            g.add_node(Node.from_dict(n))
        for e in data.get("edges", []):
            g.add_edge(Edge.from_dict(e))
        for c in data.get("constraints", []):
            g.add_constraint(Constraint(**c))
        return g
