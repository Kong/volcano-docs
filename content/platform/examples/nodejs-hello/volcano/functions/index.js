exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    const name = event.name || 'World';
    const environment = process.env.ENVIRONMENT || 'unknown';
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Hello 123, ${name}!`,
            environment: environment,
            timestamp: new Date().toISOString()
        })
    };
};
