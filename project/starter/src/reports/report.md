# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | 89/100 |
| **Files Reviewed** | 6 |
| **Critical Issues** | 1 |
| **High Priority Tests** | 3 |
| **Refactoring Opportunities** | 7 |

## 🎯 Top Recommendations

1. 🚨 **Testing**: Add iframe integration tests to validate that the tools permission correctly flows through to iframe creation and sets the allow='tools' attribute. This is the primary use case mentioned in the PR description.
   - Files: src/app-bridge.test.ts

2. ⚠️ **Security**: Add security documentation explaining the security implications of granting tools permission and best practices for tool registration. The permission grants broad capabilities without fine-grained controls.
   - Files: specification/draft/apps.mdx

3. ⚠️ **Testing**: Add edge case tests for the tools permission including undefined, null, missing properties, and various permission combinations to ensure robust handling of all scenarios.
   - Files: src/app-bridge.test.ts

4. ⚠️ **Testing**: Add schema validation tests for the generated Zod schema to ensure the tools field correctly validates expected inputs and rejects invalid ones.
   - Files: src/generated/schema.ts

5. ⚠️ **Refactoring**: Replace repetitive if-statement pattern with a data-driven approach using a permission mapping object. This will significantly improve maintainability and reduce code duplication.
   - Files: src/app-bridge.ts

## 📁 File Details

### 📄 `src/app-bridge.ts`

**Quality Score:** 85/100 | **Coverage:** ~65%

#### Issues (4)
  - Line 197: `low` The new permission check follows the existing pattern but lacks alphabetical ordering. The list appears to be ordered by permission type rather than alphabetically, which could lead to inconsistencies.
  - Line 194: `info` The buildAllowAttribute function uses multiple if-statements to build the allowList array. While readable, this approach requires adding a new if-statement for each permission type.
  - Line 197: `medium` The implementation grants tools permission through an empty object {}. There's no validation of what tools can be registered or what actions they can perform.

  *...and 1 more*

#### Test Gaps (4)
  - `buildAllowAttribute function, line 197 (tools permission)` (high priority)
  - `buildAllowAttribute function with tools in various positions` (medium priority)

  *...and 2 more*

#### Refactoring Opportunities (3)
  - **simplify**: The current implementation uses five sequential if-statements to check each permission. This pattern creates high maintenance overhead as each new permission requires adding another if-statement.
  - **extract-function**: The mapping between TypeScript permission names (camelCase) and Permission Policy feature names (kebab-case) is implicit in the code. Extracting this as a separate configuration makes the transformation explicit.

  *...and 1 more*

---

### 📄 `src/app-bridge.test.ts`

**Quality Score:** 88/100 | **Coverage:** ~70%

#### Issues (3)
  - Line 2821: `info` The new test case is well-structured and follows the existing test pattern. However, it only tests the isolated case.
  - Line 2841: `low` The test assertion string is manually maintained and must be updated each time a permission is added. This is fragile and error-prone.
  - Line 2820: `low` No test verifies that the tools permission is correctly ignored when not set or when set to undefined/null.


#### Test Gaps (1)
  - `Test for tools permission edge cases` (high priority)


#### Refactoring Opportunities (1)
  - **modernize**: The test uses a hardcoded string comparison which is brittle when permissions are added or reordered.


---

### 📄 `src/spec.types.ts`

**Quality Score:** 90/100 | **Coverage:** ~0%

#### Issues (2)
  - Line 694: `low` The type definition uses {} for the tools property, which is consistent with other permissions but could be more explicit about being an empty object or marker type.
  - Line 689: `info` The JSDoc comment is concise but could benefit from additional context about when/why this permission is needed.


#### Test Gaps (1)
  - `McpUiResourcePermissions interface with tools property` (medium priority)


#### Refactoring Opportunities (1)
  - **modernize**: The empty object type {} is implicit and could be more explicit about its intent as a marker type.


---

### 📄 `src/generated/schema.ts`

**Quality Score:** 92/100 | **Coverage:** ~0%

#### Issues (2)
  - Line 344: `info` This is a generated file. Any issues here should be fixed in the source schema, not in this file directly.
  - Line 344: `low` The Zod schema uses .object({}) which accepts any object, even with additional properties. While this matches other permissions, it's not the strictest validation.


#### Test Gaps (1)
  - `McpUiResourcePermissionsSchema with tools field` (high priority)


#### Refactoring Opportunities (1)
  - **pattern-improvement**: The schema uses .object({}) which is permissive. Adding .strict() would provide stronger validation.


---

### 📄 `src/generated/schema.json`

**Quality Score:** 93/100 | **Coverage:** ~0%

#### Issues (2)
  - Line 1: `info` The schema definition uses 'additionalProperties': false which is stricter than the Zod schema's .object({}). This is actually good for validation but creates a slight inconsistency.
  - Line 1: `info` This is a generated file that appears in 5 different locations within the schema structure, suggesting it's used in multiple contexts (permissions, capabilities, etc.).


#### Test Gaps (1)
  - `JSON schema validation for tools field` (medium priority)


#### Refactoring Opportunities (0)
  None found


---

### 📄 `specification/draft/apps.mdx`

**Quality Score:** 87/100 | **Coverage:** ~0%

#### Issues (2)
  - Line 196: `low` The documentation correctly adds the tools permission to all relevant locations (4 locations total), but lacks examples or detailed explanation of what 'WebMCP tools access' means for app developers.
  - Line 199: `info` The documentation mentions 'Maps to Permission Policy tools feature' but doesn't provide a hyperlink to the WebMCP specification.


#### Test Gaps (1)
  - `Documentation examples and code samples` (low priority)


#### Refactoring Opportunities (1)
  - **modernize**: The documentation could benefit from a dedicated section explaining the tools permission with usage examples.


---

*Generated at 2026-09-28T00:00:00Z • Duration: 334725ms*
