import json
import os
from datetime import datetime


def handler(event, context):
    """
    Example Python Lambda function for Volcano Hosting
    Processes data and returns a response
    """
    print(f"Event received: {json.dumps(event)}")
    
    # Get environment variables
    environment = os.environ.get('ENVIRONMENT', 'unknown')
    api_key = os.environ.get('API_KEY', 'not-set')
    
    # Process the event
    data = event.get('data', [])
    result = {
        'count': len(data),
        'items': data,
        'environment': environment,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(result)
    }
