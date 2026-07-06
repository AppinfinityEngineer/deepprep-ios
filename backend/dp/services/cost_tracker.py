"""Rough cost estimation for search + LLM usage (GBP)."""
from ..models import ReportCost

# Placeholder unit costs — TODO(branch-10): tune with real provider pricing.
_SEARCH_COST_PER_QUERY_GBP = 0.006
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
) -> ReportCost:
    input_tokens = max(1, input_chars // 4)
    output_tokens = max(1, output_chars // 4)
    search_cost = round(query_count * _SEARCH_COST_PER_QUERY_GBP, 5)
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
