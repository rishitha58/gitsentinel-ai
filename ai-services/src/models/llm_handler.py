import json
import os

from openai import OpenAI
from dotenv import load_dotenv

from .prompt_templates import CODE_ANALYSIS_PROMPT

load_dotenv()

# Groq client
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)


class LLMHandler:
    def __init__(self):

        # Default Groq model
        self.model_name = os.getenv(
            "MODEL_NAME",
            "llama-3.3-70b-versatile"
        )

        self.max_tokens = int(
            os.getenv("MAX_TOKENS", "4000")
        )

    def analyze_diff(
        self,
        diff: str,
        pr_data: dict
    ) -> dict:

        # Prevent huge diffs
        max_diff_chars = 15000

        if len(diff) > max_diff_chars:
            diff = (
                diff[:max_diff_chars]
                + "\n\n[DIFF TRUNCATED]"
            )

        # Build prompt
        user_prompt = CODE_ANALYSIS_PROMPT.format(
            pr_title=pr_data.get(
                "prTitle",
                "Unknown"
            ),
            repo_owner=pr_data.get(
                "repoOwner",
                "Unknown"
            ),
            repo_name=pr_data.get(
                "repoName",
                "Unknown"
            ),
            author_login=pr_data.get(
                "authorLogin",
                "Unknown"
            ),
            diff=diff,
        )

        print(
            f"🤖 Calling {self.model_name} "
            f"with {len(diff)} char diff"
        )

        try:

            response = client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                temperature=0.1,
                max_tokens=self.max_tokens
            )

            raw_response = (
                response
                .choices[0]
                .message
                .content
            )

            # Parse JSON response
            analysis = json.loads(raw_response)

            print(
                f"✅ Analysis complete: "
                f"{len(analysis.get('issues', []))} issues found"
            )

            return analysis

        except json.JSONDecodeError as e:

            print(f"❌ JSON parse error: {e}")

            try:
                print(
                    f"Raw response: "
                    f"{raw_response[:500]}"
                )
            except:
                pass

            return self._empty_result()

        except Exception as e:

            print(f"❌ Groq API error: {e}")
            raise

    def _empty_result(self):

        return {
            "prSummary":
                "Analysis could not be completed.",
            "riskScore": 0,
            "filesAnalyzed": 0,
            "securityIssues": 0,
            "performanceIssues": 0,
            "qualityIssues": 0,
            "passedChecks": 0,
            "issues": [],
        }


# Singleton instance
llm_handler = LLMHandler()