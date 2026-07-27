---
title: "Security checklist"
description: "Use this checklist before deploying your Volcano application to production."
---

Use this checklist before deploying your Volcano application to production.

## Authentication

### API keys

- [ ] Using separate anon keys for development and production
- [ ] Service keys stored in environment variables, not in code
- [ ] Service keys never exposed in frontend applications
- [ ] Platform tokens rotated on a regular schedule

### Token configuration

- [ ] Access token lifetime set appropriately (default: 1 hour)
- [ ] Refresh token lifetime not excessively long (default: 7 days)
- [ ] Session timeouts configured if your application requires them
- [ ] Password requirements configured (minimum length, complexity)

### Rate limiting

- [ ] Rate limits configured for signup, signin, and password reset
- [ ] Rate limits tested under load
- [ ] Rate limit headers checked in responses

## Database security

### Row-level security

- [ ] RLS enabled on all tables containing user data
- [ ] RLS policies tested with multiple users
- [ ] No tables accessible without authentication (unless intended)
- [ ] Auth helpers installed (`auth.uid()`, `auth.email()`, etc.)

### Connection security

- [ ] Database connection strings not exposed in client code
- [ ] Using the `DATABASE_URL` environment variable in functions
- [ ] Database passwords are strong and unique

## API security

### HTTPS and CORS

- [ ] HTTPS enabled for all production traffic
- [ ] CORS configured to allow only your domains
- [ ] Not using wildcard (`*`) CORS in production

### Input validation

- [ ] All user input validated before processing
- [ ] SQL queries use parameterized statements (automatic with Volcano)
- [ ] File uploads have size and type restrictions

### Error handling

- [ ] Error messages don't expose internal details
- [ ] Stack traces not returned to clients in production
- [ ] Authentication failures return generic messages

## Monitoring

### Logging and alerts

- [ ] Failed authentication attempts monitored
- [ ] Rate limit violations generate alerts
- [ ] Unusual signup patterns detected
- [ ] Function errors logged and reviewed

### Metrics

- [ ] Authentication success rates tracked
- [ ] Response times monitored
- [ ] Database query performance measured

## Data protection

### Encryption

- [ ] Data encrypted at rest (PostgreSQL default)
- [ ] Data encrypted in transit (HTTPS)
- [ ] Sensitive fields handled appropriately

### Data retention

- [ ] Data retention policy defined
- [ ] User deletion cascade verified (deleting a user removes their data)
- [ ] Backup strategy in place

## Compliance

### GDPR

- [ ] Users can request their data
- [ ] Users can delete their accounts
- [ ] Privacy policy updated and accessible
- [ ] Cookie consent implemented if applicable

### General

- [ ] Terms of service available
- [ ] Data processing agreements in place with third parties
- [ ] Security incident response plan documented

## Pre-launch verification

### Testing

- [ ] All tests passing
- [ ] Security tests included in CI/CD pipeline
- [ ] Manual penetration testing completed (if required)
- [ ] Load testing performed

### Deployment

- [ ] All database migrations applied
- [ ] Environment variables set correctly
- [ ] Health check endpoints configured
- [ ] Rollback plan documented

## Incident response

Have documented plans for:

| Scenario | Response |
|----------|----------|
| Compromised anon key | Revoke and regenerate, no data exposed |
| Compromised service key | Revoke immediately, audit database for changes |
| Brute force attack | Lower rate limits, review authentication logs |
| Data breach | Notify affected users, investigate scope |
| DDoS attack | Enable additional rate limiting, contact support |

## Post-launch monitoring

- [ ] Monitor error rates for the first 24-48 hours
- [ ] Check authentication success rates
- [ ] Verify rate limiting is working as expected
- [ ] Review security logs for anomalies
- [ ] Test account deletion flow

## What's next

| Guide | Description |
|-------|-------------|
| [Service keys](../authentication/security/service-keys.md) | Secure your service keys |
| [Row-level security](../databases/row-level-security.md) | Protect data with RLS |
