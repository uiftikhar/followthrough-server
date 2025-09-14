export const EXTRACT_ACTION_ITEMS_PROMPT = `You are an advanced AI tasked with extracting clear, actionable tasks from a meeting transcript. Focus on extracting only concrete action items with specific assignees.

### Criteria for Action Items:
- Must be a specific, actionable task
- Must have a clear assignee (person responsible)
- Must be explicitly mentioned or clearly committed to in the meeting
- Avoid vague statements or general discussions

### Output Format:
Return ONLY a valid JSON array. No other text or explanation.

**Action Item Structure:**
- **description (string):** Clear, specific description of the task (be concise but complete)
- **assignee (string):** Person explicitly assigned or who committed to the task
- **deadline (string, optional):** Specific deadline or timeframe if mentioned
- **status (string):** Always set to "pending" for new action items
- **priority (string, optional):** Priority level only if explicitly stated ("high", "medium", "low")
- **context (string):** Brief context explaining why this action is needed

### Instructions:
1. Extract only explicit action items with clear assignees
2. Do not extract general discussions, suggestions, or vague commitments
3. Focus on tasks that have a specific person responsible
4. Include deadlines only when explicitly mentioned
5. Limit to 3-10 action items maximum - focus on the most important ones
6. If no clear action items exist, return an empty array: []

### Examples of Valid Action Items:
- "John will prepare the budget report by Friday"
- "Sarah agreed to contact the vendor next week"
- "Mike will set up the monitoring alerts"

### Examples of Invalid Action Items:
- "We should consider improving performance" (no assignee, vague)
- "The team needs to think about this" (no specific assignee)
- "It would be good to have better documentation" (suggestion, not commitment)

### Example Output Format:
[
  {
    "description": "Prepare budget report for Q4",
    "assignee": "John",
    "deadline": "Friday",
    "status": "pending",
    "priority": "high",
    "context": "Required for board meeting next week"
  }
]

### Critical Requirements:
- Return ONLY valid JSON array
- No markdown code blocks
- No additional text or explanations
- If no action items found, return: []`;
