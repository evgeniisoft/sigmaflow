"""
Тест загрузки графа из YAML и прямого прохода вычислений.
"""

import sys
import os

# Добавляем родительскую папку в путь для импорта engine
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.graph import Graph
import yaml


def load_graph(path: str) -> Graph:
    """Загрузка графа из YAML-файла."""
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return Graph.from_dict(data)


def main():
    print("=" * 60)
    print("SIGMAFLOW — Тест загрузки и вычислений")
    print("=" * 60)

    # Загрузка графа
    demo_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "examples",
        "demo_retail.yaml"
    )

    print(f"\nЗагрузка файла: {demo_path}")

    try:
        g = load_graph(demo_path)
    except FileNotFoundError:
        print("ОШИБКА: Файл не найден.")
        return
    except Exception as e:
        print(f"ОШИБКА загрузки: {e}")
        return

    print(f"Проект: {g.name}")
    print(f"Узлов: {len(g.nodes)}")
    print(f"Связей: {len(g.edges)}")
    print(f"Ограничений: {len(g.constraints)}")

    # Вывод исходных значений
    print("\n--- Исходные значения ---")
    print(f"{'ID':20s} {'Тип':14s} {'Значение':>12s} {'Мин':>10s} {'Макс':>10s}")
    print("-" * 66)
    for node in g.nodes.values():
        val = f"{node.value:,.0f}" if isinstance(node.value, (int, float)) else str(node.value or "—")
        mn = f"{node.min:,.0f}" if isinstance(node.min, (int, float)) else "—"
        mx = f"{node.max:,.0f}" if isinstance(node.max, (int, float)) else "—"
        print(f"{node.id:20s} {node.type:14s} {val:>12s} {mn:>10s} {mx:>10s}")

    # Вычисление
    print("\n--- Вычисление... ---")
    g.compute()

    # Вывод результатов
    print("\n--- Результаты вычислений ---")
    print(f"{'ID':20s} {'Тип':14s} {'Значение':>12s}")
    print("-" * 46)
    for node in g.nodes.values():
        if node.value is not None:
            val = f"{node.value:,.0f}" if isinstance(node.value, float) else str(node.value)
        else:
            val = "—"
        print(f"{node.id:20s} {node.type:14s} {val:>12s}")

    print("\n--- Проверка ограничений ---")
    for c in g.constraints:
        node = g.nodes.get(c.node)
        if node is None:
            print(f"  {c.node}: узел не найден")
            continue
        if node.value is None:
            print(f"  {c.node}: значение не вычислено")
            continue

        op = c.operator
        target = c.value
        actual = node.value

        if op == ">=":
            ok = actual >= target
        elif op == "<=":
            ok = actual <= target
        elif op == "==":
            ok = actual == target
        elif op == ">":
            ok = actual > target
        elif op == "<":
            ok = actual < target
        else:
            ok = False

        status = "OK" if ok else "НАРУШЕНО"
        print(f"  {c.node} {op} {target:,.0f} | Факт: {actual:,.0f} | {status}")

    print("\n" + "=" * 60)
    print("Тест завершён.")
    print("=" * 60)


if __name__ == "__main__":
    main()
