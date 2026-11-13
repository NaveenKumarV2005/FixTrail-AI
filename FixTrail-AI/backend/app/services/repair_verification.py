
import os
import json
import base64
import mimetypes
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

load_dotenv(override=True)

api_key = os.getenv("GROQ_API_KEY")
model = os.getenv("GROQ_MODEL")

if not api_key:
    raise ValueError("GROQ_API_KEY is missing from backend/.env")

if not model:
    raise ValueError("GROQ_MODEL is missing from backend/.env")

client = Groq(api_key=api_key)

# backend/ directory
BACKEND_DIR = Path(__file__).resolve().parents[2]


def resolve_image_path(image_path):
    """Resolve a stored image path relative to the backend directory."""
    path = Path(image_path)

    if not path.is_absolute():
        path = BACKEND_DIR / path

    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")

    return path


def encode_image(image_path):
    """Convert an image into a base64 data URL."""
    path = resolve_image_path(image_path)

    mime_type, _ = mimetypes.guess_type(str(path))

    if not mime_type or not mime_type.startswith("image/"):
        raise ValueError(f"Unsupported image type: {path}")

    with open(path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")

    return f"data:{mime_type};base64,{encoded}"


def verify_repair_images(
    damage_image_paths,
    completion_image_paths,
    approved_description,
    appliance_name
):
    """
    Compare original damage images with technician completion images.
    Returns a structured visual verification report.
    """

    if not damage_image_paths:
        raise ValueError("No original damage images were provided.")

    if not completion_image_paths:
        raise ValueError("No technician completion images were provided.")

    # Groq model image request: use up to 3 images per request.
    selected_images = [
        ("CUSTOMER ORIGINAL DAMAGE", damage_image_paths[0]),
        ("TECHNICIAN COMPLETION", completion_image_paths[0])
    ]

    if len(damage_image_paths) > 1:
        selected_images.append(
            ("ADDITIONAL ORIGINAL DAMAGE", damage_image_paths[1])
        )
    elif len(completion_image_paths) > 1:
        selected_images.append(
            ("ADDITIONAL COMPLETION EVIDENCE", completion_image_paths[1])
        )

    prompt = f"""
You are the visual repair-verification assistant for FixTrail AI.

Appliance: {appliance_name}

Customer-approved repair description:
{approved_description}

Compare the provided original damage photographs with the
technician's completion photographs.

Return a JSON object with exactly these fields:

{{
  "appliance": "Appliance name",
  "original_damage": ["Visible original damage"],
  "completed_work_detected": ["Work visibly supported by photos"],
  "unresolved_issues": ["Visible issues that may remain"],
  "verification_status": "needs_review",
  "confidence": 0.0,
  "explanation": "Short explanation"
}}

Rules:
1. Compare the original and completion photographs.
2. Check whether the visible evidence supports the approved work.
3. Do not assume work was completed if the photographs do not show it.
4. Do not invent damage, repairs, or component failures.
5. Do not claim the appliance functions correctly or is electrically safe.
6. If evidence is unclear, incomplete, or inconsistent, use needs_review.
7. Use only these verification_status values:
   - verified
   - needs_review
   - mismatch
8. Confidence must be a number between 0 and 1.
9. Return valid JSON only. Do not use Markdown or code fences.
"""

    content = [{"type": "text", "text": prompt}]

    for label, image_path in selected_images:
        content.append({
            "type": "text",
            "text": f"Image category: {label}"
        })

        content.append({
            "type": "image_url",
            "image_url": {
                "url": encode_image(image_path)
            }
        })

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": content
            }
        ],
        max_completion_tokens=1000
    )

    result_text = response.choices[0].message.content

    if not result_text:
        raise ValueError("The AI returned an empty response.")

    # Handle accidental Markdown code fences.
    result_text = result_text.strip()

    if result_text.startswith("```"):
        result_text = result_text.split("\n", 1)[1]
        result_text = result_text.rsplit("```", 1)[0].strip()

    result = json.loads(result_text)

    allowed_statuses = {"verified", "needs_review", "mismatch"}

    if result.get("verification_status") not in allowed_statuses:
        result["verification_status"] = "needs_review"

    try:
        confidence = float(result.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0

    result["confidence"] = max(0.0, min(1.0, confidence))

    return result


def describe_damage_image(image_bytes, content_type):
    """
    Generate a customer-friendly description of visible appliance damage.
    """

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp"
    }

    if content_type not in allowed_types:
        raise ValueError("Only JPG, PNG and WEBP images are supported.")

    if not image_bytes:
        raise ValueError("The uploaded image is empty.")

    encoded_image = base64.b64encode(image_bytes).decode("utf-8")

    image_url = f"data:{content_type};base64,{encoded_image}"

    prompt = """
You are the image description assistant for FixTrail AI.

Examine this photograph of a potentially damaged household appliance.

Write a short, clear description that a customer can use in a repair request.

Rules:
1. Describe only damage that is visibly supported by the photograph.
2. Mention visible cracks, dents, burns, broken parts, leaks,
   or other visible issues when present.
3. Do not invent internal faults or causes.
4. Do not claim that the appliance is working or not working
   unless this is directly evident from the image.
5. If the damage is unclear, say that it needs physical inspection.
6. Use simple English.
7. Return only the description, without headings or Markdown.
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        }
                    }
                ]
            }
        ],
        max_completion_tokens=300
    )

    description = response.choices[0].message.content

    if not description:
        raise ValueError("AI could not generate a description.")

    return description.strip()
