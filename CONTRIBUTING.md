# Contributing to AWS Command Schemas

🎉 Thank you for your interest in contributing! This project automatically extracts AWS command parameters from boto3 service definitions.

## 📋 Quick Overview

This project:
- ✅ Extracts real AWS parameters from boto3 `service-2.json` files
- ✅ Organizes schemas by service folders
- ✅ Auto-updates via GitHub Actions
- ✅ Provides individual JSON files per AWS command

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Git
- Basic understanding of AWS SDK structure

### Setup Development Environment

```bash
# 1. Fork and clone the repository
git clone https://github.com/kamranbiglari/aws-sdk-schema-extractor.git
cd aws-sdk-schema-extractor

# 2. Install dependencies
npm install

# 3. Clone botocore (needed for extraction)
git clone https://github.com/boto/botocore.git

# 4. Run extraction to test
export BOTOCORE_DATA_PATH=./botocore/botocore/data
npm run extract

# 5. Validate schemas
npm run validate

# 6. Run tests
npm test
```

## 🎯 Ways to Contribute

### 1. 🐛 Report Issues

Found a problem? Please create an issue with:

```markdown
**Bug Description**: Clear description of the issue
**Steps to Reproduce**: How to reproduce the problem
**Expected Behavior**: What should happen
**Actual Behavior**: What actually happens
**Environment**: 
- Node.js version: 
- OS: 
- Botocore version: 

**Additional Context**: Screenshots, logs, etc.
```

### 2. 💡 Suggest Enhancements

Have an idea? Create an issue with:

```markdown
**Enhancement Description**: What you'd like to see
**Use Case**: Why this would be helpful
**Proposed Solution**: How it might work
**Alternatives**: Other approaches considered
```

### 3. 🔧 Code Contributions

#### Extraction Logic Improvements

Areas where help is needed:

- **Parameter Type Detection**: Improve accuracy of type mapping
- **Documentation Parsing**: Better cleaning of AWS documentation
- **Error Handling**: More robust error recovery
- **Performance**: Optimize extraction speed
- **Coverage**: Support more AWS services

#### Code Organization

- **Modular Architecture**: Split extraction logic into focused modules
- **Testing**: Add comprehensive test coverage
- **Validation**: Improve schema validation logic
- **Documentation**: Code comments and examples

### 4. 📚 Documentation

- **README Improvements**: Clearer examples and usage
- **Code Comments**: Document complex extraction logic
- **Examples**: Real-world usage patterns
- **Tutorials**: How to use extracted schemas

## 📝 Development Workflow

### 1. Branch Naming

```bash
# Features
git checkout -b feature/improve-type-detection

# Bug fixes  
git checkout -b fix/handle-missing-shapes

# Documentation
git checkout -b docs/add-usage-examples
```

### 2. Making Changes

```bash
# Make your changes
# Test extraction
npm run extract

# Validate output
npm run validate

# Run tests
npm test

# Check formatting
npm run lint
```

### 3. Commit Messages

Use conventional commits:

```bash
# Features
git commit -m "feat: improve parameter type detection for complex shapes"

# Bug fixes
git commit -m "fix: handle missing shape definitions gracefully"

# Documentation
git commit -m "docs: add examples for schema loading"

# Tests
git commit -m "test: add validation for nested parameter structures"
```

### 4. Pull Request Process

1. **Create PR** with clear title and description
2. **Link Issues** that the PR addresses
3. **Add Tests** for new functionality
4. **Update Documentation** if needed
5. **Ensure CI Passes** (GitHub Actions)

#### PR Template

```markdown
## 🎯 Purpose
Brief description of what this PR does

## 🔄 Changes
- List of specific changes made
- Files modified
- New functionality added

## 🧪 Testing
- [ ] Extraction runs successfully
- [ ] Validation passes
- [ ] Tests added/updated
- [ ] Manual testing completed

## 📚 Documentation
- [ ] README updated (if needed)
- [ ] Code comments added
- [ ] Examples provided

## 🔗 Related Issues
Fixes #123
Relates to #456

## 🎨 Screenshots (if applicable)
Before/after comparisons, output examples
```

## 🧪 Testing Guidelines

### Test Structure

```javascript
// src/test.js example
import { validateSchema } from './validator.js';

async function testSchemaValidation() {
  console.log('🧪 Testing schema validation...');
  
  // Test valid schema
  const validSchema = {
    command: 'TestCommand',
    parameters: { param1: { type: 'string', required: true } }
  };
  
  assert(validateSchema(validSchema), 'Valid schema should pass');
  
  // Test invalid schema
  const invalidSchema = { invalid: true };
  assert(!validateSchema(invalidSchema), 'Invalid schema should fail');
  
  console.log('✅ Schema validation tests passed');
}
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
node src/test-extraction.js

# Run with verbose output
npm test -- --verbose
```

## 🏗️ Architecture Overview

### Core Components

```
src/
├── extractor.js          # Main extraction logic
├── parser.js             # Service-2.json parsing
├── validator.js          # Schema validation
├── loader.js             # Runtime schema loading
└── utils.js              # Helper functions
```

### Key Functions

- **`parseServiceJson()`**: Parse individual service-2.json files
- **`extractParameters()`**: Extract parameter info from shapes
- **`validateSchema()`**: Ensure schema correctness
- **`organizeByService()`**: Create service folder structure

## 📋 Code Style

### JavaScript Style

```javascript
// Use modern ES6+ features
import { parseService } from './parser.js';

// Clear function names
async function extractParametersFromShape(shapeName, shapes) {
  // Document complex logic
  // Handle errors gracefully
  try {
    return await processShape(shapeName, shapes);
  } catch (error) {
    console.error(`Failed to process shape ${shapeName}:`, error.message);
    return null;
  }
}

// Use descriptive variable names
const requiredParameters = [];
const optionalParameters = [];
```

### Documentation Style

```javascript
/**
 * Extract parameters from AWS service operation
 * @param {string} serviceName - AWS service name (e.g., 'elasticache')
 * @param {string} operationName - Operation name (e.g., 'AddTagsToResource')
 * @param {Object} operationDef - Operation definition from service-2.json
 * @param {Object} shapes - Shape definitions
 * @returns {Promise<Object>} Extracted parameter schema
 */
async function extractOperationParameters(serviceName, operationName, operationDef, shapes) {
  // Implementation
}
```

## 🚦 Release Process

### Automated Releases

GitHub Actions automatically:
1. **Checks** for botocore updates daily
2. **Extracts** new schemas when updates found
3. **Creates** releases with updated files
4. **Updates** documentation

### Manual Release

```bash
# Update version
npm version patch|minor|major

# Push tags
git push --tags

# GitHub Actions handles the rest
```

## ❓ Getting Help

### Communication Channels

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/kamranbiglari/aws-sdk-schema-extractor/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/kamranbiglari/aws-sdk-schema-extractor/discussions)
- 📧 **Email**: your.email@example.com

### Before Asking

1. **Search existing issues** for similar problems
2. **Check documentation** and examples
3. **Try latest version** in case it's already fixed
4. **Provide minimal reproduction** case

## 🙏 Recognition

Contributors will be:
- ✨ **Added to README** acknowledgments
- 🏆 **Mentioned in releases** for significant contributions  
- 📢 **Highlighted** in community discussions

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). Please be respectful and inclusive in all interactions.

### Quick Guidelines

- ✅ **Be respectful** of different viewpoints
- ✅ **Provide constructive feedback**
- ✅ **Help newcomers** get started
- ✅ **Focus on the technical merits**
- ❌ **No harassment or discrimination**

---

**Thank you for contributing to make AWS SDK usage easier for everyone!** 🚀