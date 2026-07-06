"""Rough cost estimation for search + LLM usage (GBP)."""
from __future__ import annotations

from ..models import ReportCost

# Tavily is priced in credits; keep this conservative and easy to tune.
_SEARCH_COST_PER_CREDIT_GBP = 0.0065
_LLM_INPUT_PER_1K_GBP = 0.0003
_LLM_OUTPUT_PER_1K_GBP = 0.0012


def estimate(
    provider: str,
    model: str,
    query_count: int,
    result_count: int,
    input_chars: int,
    output_chars: int,
    seconds: float,
    search_credit_count: int | None = None,
) -> ReportCost:
    input_tokens = max(1, input_chars // 4)
    output_tokens = max(1, output_chars // 4)
    credits = search_credit_count if search_credit_count is not None else query_count
    search_cost = round(max(0, credits) * _SEARCH_COST_PER_CREDIT_GBP, 5)
    llm_cost = round(
        (input_tokens / 1000) * _LLM_INPUT_PER_1K_GBP
        + (output_tokens / 1000) * _LLM_OUTPUT_PER_1K_GBP,
        5,
    )
    return ReportCost(
        searchQueryCount=query_count,
        searchResultCount=result_count,
        llmProvider=provider,
        llmModel=model,
        inputTokens=input_tokens,
        outputTokens=output_tokens,
        estimatedSearchCostGbp=search_cost,
        estimatedLlmCostGbp=llm_cost,
        estimatedTotalCostGbp=round(search_cost + llm_cost, 5),
        generationSeconds=round(seconds, 2),
    )
