from __future__ import annotations

from sympy import (
    Eq,
    Float,
    Integer,
    Limit,
    Integral,
    Sum,
    Derivative,
    evalf,
    latex,
    limit,
    parse_expr,
    solve,
    summation,
    integrate,
    diff,
    symbols,
    simplify,
    factor,
    expand,
    Rational,
    sqrt,
    pi,
    E,
    sin,
    cos,
    tan,
    log,
    factorial,
    gcd,
    lcm,
   pretty,
)

from app.tools.registry import BaseTool

_SAFE_LOCALS = {
    "x": symbols("x"), "y": symbols("y"), "z": symbols("z"),
    "t": symbols("t"), "n": symbols("n"), "a": symbols("a"),
    "b": symbols("b"), "c": symbols("c"),
    "sin": sin, "cos": cos, "tan": tan,
    "sqrt": sqrt, "log": log, "ln": log,
    "pi": pi, "E": E,
    "factorial": factorial,
    "gcd": gcd, "lcm": lcm,
    "Rational": Rational,
}


class Calculator(BaseTool):
    name: str = "calculator"
    description: str = "执行数学计算，包括代数运算、解方程、微积分、化简、因式分解等。支持 Python/SymPy 表达式。"
    parameters: dict = {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "数学表达式，如 'solve(x**2 - 4, x)', 'integrate(x**2, x)', 'factor(x**2 - 4)', 'simplify(...)', '2 + 3*5'",
            },
            "explain": {
                "type": "boolean",
                "description": "是否返回分步解释",
                "default": False,
            },
        },
        "required": ["expression"],
    }

    async def execute(self, expression: str, explain: bool = False) -> str:
        try:
            result = self._evaluate(expression.strip())
            expr_latex = self._to_latex(expression)
            result_latex = self._to_latex(result)
            pretty_str = pretty(result)

            lines = [f"**表达式**: ${expr_latex}$" if expr_latex else f"**表达式**: {expression}"]
            lines.append(f"**结果**: ${result_latex}$" if result_latex else f"**结果**: {pretty_str}")

            if explain:
                lines.append(f"\n**数值近似**: {evalf(result) if hasattr(result, 'evalf') else result}")
                lines.append(f"\n**类型**: {type(result).__name__}")

            return "\n".join(lines)
        except Exception as e:
            return f"计算错误: {e}"

    def _evaluate(self, expr: str) -> object:
        # 处理常见数学函数调用
        expr_lower = expr.lower()

        if expr_lower.startswith("solve("):
            return self._handle_solve(expr)
        if expr_lower.startswith("integrate(") or expr_lower.startswith("integral("):
            return self._handle_integrate(expr)
        if expr_lower.startswith("diff(") or expr_lower.startswith("derivative("):
            return self._handle_diff(expr)
        if expr_lower.startswith("limit("):
            return self._handle_limit(expr)
        if expr_lower.startswith("summation(") or expr_lower.startswith("sum("):
            return self._handle_summation(expr)
        if expr_lower.startswith("factor("):
            return self._handle_factor(expr)
        if expr_lower.startswith("expand("):
            return self._handle_expand(expr)
        if expr_lower.startswith("simplify("):
            return self._handle_simplify(expr)
        if expr_lower.startswith("plot("):
            return "plot 工具请使用 plotter 工具"

        # 纯数值/符号表达式计算
        parsed = parse_expr(expr, local_dict=_SAFE_LOCALS)
        return parsed

    def _handle_solve(self, expr: str) -> object:
        # solve(x**2 - 4, x) 或 solve([eq1, eq2], [x, y])
        inner = expr[len("solve("):-1]
        parts = self._split_args(inner)
        if len(parts) == 1:
            eq = parse_expr(parts[0], local_dict=_SAFE_LOCALS)
            return solve(eq)
        elif len(parts) == 2:
            eq = parse_expr(parts[0], local_dict=_SAFE_LOCALS)
            sym = parse_expr(parts[1], local_dict=_SAFE_LOCALS)
            return solve(eq, sym)
        return solve(*[parse_expr(p, local_dict=_SAFE_LOCALS) for p in parts])

    def _handle_integrate(self, expr: str) -> object:
        inner = expr[expr.index("(")+1:expr.rindex(")")]
        parts = self._split_args(inner)
        if len(parts) == 2:
            f = parse_expr(parts[0], local_dict=_SAFE_LOCALS)
            x = parse_expr(parts[1], local_dict=_SAFE_LOCALS)
            return integrate(f, x)
        elif len(parts) == 4:
            f = parse_expr(parts[0], local_dict=_SAFE_LOCALS)
            x = parse_expr(parts[1], local_dict=_SAFE_LOCALS)
            a = parse_expr(parts[2], local_dict=_SAFE_LOCALS)
            b = parse_expr(parts[3], local_dict=_SAFE_LOCALS)
            return integrate(f, (x, a, b))
        return integrate(*[parse_expr(p, local_dict=_SAFE_LOCALS) for p in parts])

    def _handle_diff(self, expr: str) -> object:
        inner = expr[expr.index("(")+1:expr.rindex(")")]
        parts = self._split_args(inner)
        f = parse_expr(parts[0], local_dict=_SAFE_LOCALS)
        if len(parts) == 2:
            x = parse_expr(parts[1], local_dict=_SAFE_LOCALS)
            return diff(f, x)
        elif len(parts) == 3:
            x = parse_expr(parts[1], local_dict=_SAFE_LOCALS)
            return diff(f, x, int(parts[2]))
        return diff(f)

    def _handle_limit(self, expr: str) -> object:
        inner = expr[expr.index("(")+1:expr.rindex(")")]
        parts = self._split_args(inner)
        f = parse_expr(parts[0], local_dict=_SAFE_LOCALS)
        x = parse_expr(parts[1], local_dict=_SAFE_LOCALS)
        a = parse_expr(parts[2], local_dict=_SAFE_LOCALS)
        return limit(f, x, a)

    def _handle_summation(self, expr: str) -> object:
        inner = expr[expr.index("(")+1:expr.rindex(")")]
        parts = self._split_args(inner)
        f = parse_expr(parts[0], local_dict=_SAFE_LOCALS)
        x = parse_expr(parts[1], local_dict=_SAFE_LOCALS)
        a = parse_expr(parts[2], local_dict=_SAFE_LOCALS)
        b = parse_expr(parts[3], local_dict=_SAFE_LOCALS)
        return summation(f, (x, a, b))

    def _handle_factor(self, expr: str) -> object:
        inner = expr[len("factor("):-1]
        return factor(parse_expr(inner, local_dict=_SAFE_LOCALS))

    def _handle_expand(self, expr: str) -> object:
        inner = expr[len("expand("):-1]
        return expand(parse_expr(inner, local_dict=_SAFE_LOCALS))

    def _handle_simplify(self, expr: str) -> object:
        inner = expr[len("simplify("):-1]
        return simplify(parse_expr(inner, local_dict=_SAFE_LOCALS))

    @staticmethod
    def _split_args(s: str) -> list[str]:
        """分割逗号分隔的参数，忽略括号内的逗号。"""
        args = []
        depth = 0
        current = []
        for ch in s:
            if ch in "([{":
                depth += 1
                current.append(ch)
            elif ch in ")]}":
                depth -= 1
                current.append(ch)
            elif ch == "," and depth == 0:
                args.append("".join(current).strip())
                current = []
            else:
                current.append(ch)
        if current:
            args.append("".join(current).strip())
        return args

    @staticmethod
    def _to_latex(obj: object) -> str:
        try:
            return latex(obj)
        except Exception:
            return str(obj)
