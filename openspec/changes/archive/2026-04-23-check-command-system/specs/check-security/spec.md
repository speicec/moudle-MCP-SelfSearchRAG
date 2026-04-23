## ADDED Requirements

### Requirement: Security check execution trigger
The system SHALL execute security check when `/check:security` command is invoked.

#### Scenario: Security check invocation
- **WHEN** user invokes `/check:security`
- **THEN** system identifies code files in scope (Git diff or specified paths)
- **AND** system executes security agent
- **AND** system outputs security findings report

### Requirement: Input validation check
The system SHALL check for input validation issues.

#### Scenario: External input validation
- **WHEN** security check executes
- **THEN** system identifies external input sources (API params, user input, file input)
- **AND** system checks if validation exists at entry points
- **AND** system reports unvalidated input sources

#### Scenario: Type validation
- **WHEN** security check finds external inputs
- **THEN** system checks if type validation is present
- **AND** system checks if boundary value checks exist
- **AND** system checks if null/undefined handling exists

### Requirement: SQL injection check
The system SHALL check for SQL injection vulnerabilities.

#### Scenario: Parameterized query usage
- **WHEN** security check finds database queries
- **THEN** system checks if queries use parameterized statements
- **AND** system identifies string concatenation in SQL
- **AND** system identifies direct user input in SQL strings

#### Scenario: SQL injection risk report
- **WHEN** SQL injection vulnerability detected
- **THEN** report includes vulnerable code location (file:line)
- **AND** report includes vulnerability description
- **AND** report includes severity level (High)
- **AND** report includes remediation suggestion

### Requirement: XSS/injection attack check
The system SHALL check for XSS and code injection vulnerabilities.

#### Scenario: User output sanitization
- **WHEN** security check finds user-facing outputs
- **THEN** system checks if HTML/JS escaping is applied
- **AND** system identifies unsanitized user content in responses

#### Scenario: URL redirect validation
- **WHEN** security check finds redirect operations
- **THEN** system checks if redirect URLs are validated
- **AND** system identifies open redirect vulnerabilities

### Requirement: Sensitive information leakage check
The system SHALL check for sensitive information leakage.

#### Scenario: Hardcoded credentials
- **WHEN** security check executes
- **THEN** system detects hardcoded passwords/API keys/tokens
- **AND** system detects secrets in source code patterns
- **AND** system reports each hardcoded credential with location

#### Scenario: Log information leakage
- **WHEN** security check finds logging operations
- **THEN** system checks if sensitive data is logged
- **AND** system identifies PII in log outputs

#### Scenario: Error information leakage
- **WHEN** security check finds error handlers
- **THEN** system checks if error messages expose internal structure
- **AND** system identifies verbose error responses

### Requirement: Permission validation check
The system SHALL check for permission/validation issues.

#### Scenario: Authentication check
- **WHEN** security check finds protected endpoints
- **THEN** system checks if authentication is verified
- **AND** system identifies endpoints without auth checks

#### Scenario: Authorization check
- **WHEN** security check finds resource operations
- **THEN** system checks if authorization logic exists
- **AND** system identifies missing permission checks

#### Scenario: Privilege escalation risk
- **WHEN** security check finds role-based operations
- **THEN** system checks if role validation is present
- **AND** system identifies horizontal/vertical privilege escalation risks

### Requirement: Encryption/hashing check
The system SHALL check for encryption and hashing practices.

#### Scenario: Password hashing
- **WHEN** security check finds password handling
- **THEN** system checks if secure hashing algorithm is used (bcrypt, argon2)
- **AND** system identifies weak hashing (MD5, SHA1 for passwords)

#### Scenario: Encryption algorithm
- **WHEN** security check finds encryption operations
- **THEN** system checks if secure algorithm is used (AES-256, RSA-2048+)
- **AND** system identifies deprecated/insecure algorithms

#### Scenario: Random number generation
- **WHEN** security check finds random generation for security purposes
- **THEN** system checks if cryptographically secure RNG is used
- **AND** system identifies weak RNG usage (Math.random for tokens)

### Requirement: Security report output
The system SHALL output structured security report.

#### Scenario: Severity classification
- **WHEN** security findings exist
- **THEN** report classifies issues by severity (Critical/High/Medium/Low)
- **AND** report includes OWASP category reference
- **AND** report includes remediation priority

#### Scenario: Report persistence
- **WHEN** security check completes
- **THEN** system persists report to `context/review/<timestamp>-security-<target>.md`