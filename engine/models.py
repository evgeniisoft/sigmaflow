"""
Математические модели связей между узлами графа.
"""

import math


def compute_edge(edge_type: str,
                 coefficient: float,
                 input_value: float,
                 threshold=None,
                 above=None,
                 below=None) -> float:
    """
    Вычисляет вклад одного ребра (связи) в значение целевого узла.

    Параметры:
        edge_type: тип связи (LIN, LOG, EXP, THR, DIM)
        coefficient: коэффициент влияния
        input_value: значение узла-источника
        threshold: порог для типа THR
        above: значение, если input_value >= threshold
        below: значение, если input_value < threshold

    Возвращает:
        float: вклад в значение целевого узла
    """
    if edge_type == "LIN":
        return coefficient * input_value

    elif edge_type == "LOG":
        if input_value <= 0:
            return 0.0
        return coefficient * math.log(input_value)

    elif edge_type == "EXP":
        # Ограничиваем экспоненту во избежание переполнения
        try:
            return coefficient * math.exp(min(input_value, 50))
        except OverflowError:
            return float('inf') if coefficient > 0 else float('-inf')

    elif edge_type == "DIM":
        # Diminishing returns: квадратный корень
        if input_value < 0:
            return 0.0
        return coefficient * math.sqrt(input_value)

    elif edge_type == "THR":
        if input_value >= threshold:
            return above if above is not None else input_value
        else:
            return below if below is not None else 0.0

    else:
        raise ValueError(f"Неизвестный тип связи: {edge_type}")


def calibrate_linear(x_values, y_values):
    """
    Простая линейная калибровка методом наименьших квадратов.
    Возвращает (coefficient, intercept, r_squared).

    Параметры:
        x_values: список значений X
        y_values: список значений Y

    Возвращает:
        tuple: (coefficient, intercept, r_squared)
    """
    n = len(x_values)
    if n < 2:
        return 0.0, 0.0, 0.0

    mean_x = sum(x_values) / n
    mean_y = sum(y_values) / n

    numerator = sum(
        (x - mean_x) * (y - mean_y)
        for x, y in zip(x_values, y_values)
    )
    denominator = sum((x - mean_x) ** 2 for x in x_values)

    if denominator == 0:
        return 0.0, mean_y, 0.0

    coefficient = numerator / denominator
    intercept = mean_y - coefficient * mean_x

    # Расчёт R-квадрат
    ss_res = sum(
        (y - (coefficient * x + intercept)) ** 2
        for x, y in zip(x_values, y_values)
    )
    ss_tot = sum((y - mean_y) ** 2 for y in y_values)

    r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0.0

    return coefficient, intercept, r_squared
