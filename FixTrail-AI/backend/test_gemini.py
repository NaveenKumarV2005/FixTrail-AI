
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv(override=True)

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

model = os.getenv("GROQ_MODEL")

print("Testing model:", model)

try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": "Reply only: FixTrail AI Groq connection successful."
            }
        ],
        max_completion_tokens=100
    )

    print(response.choices[0].message.content)

except Exception as error:
    print(type(error).__name__, error)
