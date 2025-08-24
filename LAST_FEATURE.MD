I want to have minumum two complete working pipelines. 

1. The first when a user says something like "please email an invoice to all clients with a balance due this week" or "Please send an email to Jane Doe reminding her to pay her invoice"
   1. For emailing I want to use mailgun as the email service. (You can either do SMPT via a library or use their API)
   2. I want it to use tooling via the LLM to accomplish this. Bascially a function /tool call that accepts an email address and a message and sends an email. 


2. The second when a user says something like "Please order any items under reorder point" or "Please order any items that are low in stock"
   1. I want to use Crossmint to order items https://docs.crossmint.com/solutions/ai-agents/agentic-commerce/payment-methods
   2. Basically a function /tool call that accepts an item url and a recipient email address and orders the item. Here is an example of the json payload: 

        https://staging.crossmint.com/api/2022-06-09/orders
        {
        "recipient": {
            "email": "john.d@example.com",
            "physicalAddress": {
            "name": "John D",
            "line1": "123 ABC Street",
            "city": "New York City",
            "state": "NY",
            "postalCode": "10007",
            "country": "US"
            }
        },
        "locale": "en-US",
        "payment": {
            "receiptEmail": "russell@vancuren.net",
            "method": "card-token"
        },
        "lineItems": {
            "productLocator": "url:https://www.nike.com/t/maverick-valor-course-tint-sunglasses-1TrBw8KB/IF0969X-021"
        }
        }