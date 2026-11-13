
import os
import base64
from dotenv import load_dotenv
from groq import Groq

load_dotenv(override=True)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
model = os.getenv("GROQ_MODEL")

# Replace this with the path to an image on your computer
IMAGE_PATH = "test_image.jpg"

with open(IMAGE_PATH, "rb") as image_file:
    image_data = base64.b64encode(image_file.read()).decode("utf-8")

prompt = """
Analyze this appliance image.

1. Identify the appliance.
2. Describe visible damage.
3. Identify possible repair requirements.
4. Mention anything that cannot be confirmed from the image.

Do not assume the appliance is functional or safe.
"""

response = client.chat.completions.create(
    model=model,
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_data}"
                    }
                }
            ]
        }
    ],
    max_completion_tokens=500
)

print("\nAI IMAGE ANALYSIS:\n")
print(response.choices[0].message.content)
