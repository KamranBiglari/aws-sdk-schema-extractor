# AWS Command Schema Extractor

🚀 **Dynamically extract and organize AWS SDK command parameters from official boto3 service definitions**

[![GitHub Actions](https://github.com/kamranbiglari/aws-sdk-schema-extractor/workflows/Extract%20AWS%20Schemas/badge.svg)](https://github.com/kamranbiglari/aws-sdk-schema-extractor/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## 🎯 What This Does

This project **automatically extracts real AWS command parameters** from the official boto3/botocore `service-2.json` files. No guessing, no hardcoded mappings—just the actual parameter definitions that AWS SDK uses internally.

### ✅ **Features**

- 📋 **Real AWS Parameters**: Extracted from official boto3 service definitions
- 🗂️ **Organized by Service**: Each AWS service gets its own folder
- 📄 **Individual Command Files**: One JSON file per AWS command
- 🔄 **Auto-Updated**: GitHub Actions keep schemas current with latest AWS releases
- 🎯 **Type Information**: Includes parameter types and requirement status
- 📚 **Documentation**: Preserves AWS parameter documentation

## 📁 Generated Structure

```
aws-schemas/
├── index.json                              # Main index
├── README.md                              # Documentation
├── elasticache/                           # ElastiCache commands
│   ├── _service-summary.json             # Service overview
│   ├── AddTagsToResourceCommand.json     # Individual command schema
│   ├── DescribeCacheClustersCommand.json
│   └── ...
├── ec2/                                   # EC2 commands
│   ├── _service-summary.json
│   ├── RunInstancesCommand.json
│   └── ...
└── s3/                                    # S3 commands
    ├── _service-summary.json
    ├── PutObjectCommand.json
    └── ...
```

## 🚀 Quick Start

### 1. Use Pre-Generated Schemas

Download the latest schemas from our [Releases](https://github.com/kamranbiglari/aws-sdk-schema-extractor/releases) or browse the [`aws-schemas/`](./aws-schemas/) directory.

```javascript
// Load a specific command schema
const addTagsSchema = require('./aws-schemas/elasticache/AddTagsToResourceCommand.json');

console.log(addTagsSchema.requiredParameters);
// Output: ["ResourceName", "Tags"]

console.log(addTagsSchema.parameters.ResourceName);
// Output: { name: "ResourceName", type: "string", required: true, ... }
```

### 2. Generate Your Own Schemas

```bash
# Clone this repository
git clone https://github.com/kamranbiglari/aws-sdk-schema-extractor.git
cd aws-sdk-schema-extractor

# Install dependencies
npm install

# Clone botocore repository (contains service definitions)
git clone https://github.com/boto/botocore.git

# Generate schemas
npm run extract

# Schemas will be created in ./aws-schemas/
```

## 📊 Example Usage

### Load Command Parameters

```javascript
const fs = require('fs');

// Load AddTagsToResourceCommand for ElastiCache
const commandSchema = JSON.parse(
  fs.readFileSync('./aws-schemas/elasticache/AddTagsToResourceCommand.json', 'utf8')
);

console.log('Required parameters:', commandSchema.requiredParameters);
// ["ResourceName", "Tags"]

console.log('Parameter details:', commandSchema.parameters);
// {
//   "ResourceName": { "type": "string", "required": true, ... },
//   "Tags": { "type": "array", "required": true, ... }
// }
```

### Load Service Summary

```javascript
// Get overview of all ElastiCache commands
const serviceSummary = JSON.parse(
  fs.readFileSync('./aws-schemas/elasticache/_service-summary.json', 'utf8')
);

console.log(`ElastiCache has ${serviceSummary.totalCommands} commands`);
console.log('Available commands:', Object.keys(serviceSummary.commands));
```

### Runtime Helper (Optional)

```javascript
const { createSchemaLoader } = require('./src/loader');

const loader = createSchemaLoader('./aws-schemas');

// Get command parameters
const params = await loader.getCommandParameters('AddTagsToResourceCommand', 'elasticache');
console.log('Required:', params.required);
console.log('Optional:', params.optional);

// Search commands
const tagCommands = await loader.searchCommands('Tag');
console.log('Commands with "Tag":', tagCommands);

// Get all commands for a service
const s3Commands = await loader.getServiceCommands('s3');
console.log('S3 commands:', s3Commands);
```

## 🔄 Automated Updates

This repository uses GitHub Actions to automatically:

1. **Check for boto3 updates** daily
2. **Extract latest schemas** when botocore is updated
3. **Create releases** with updated schema files
4. **Update documentation** with new services/commands

See [`.github/workflows/extract-schemas.yml`](./.github/workflows/extract-schemas.yml) for details.

## 🛠️ Development

### Prerequisites

- Node.js 18+
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/kamranbiglari/aws-sdk-schema-extractor.git
cd aws-sdk-schema-extractor

# Install dependencies
npm install

# Clone botocore (needed for extraction)
git clone https://github.com/boto/botocore.git

# Run extraction
npm run extract

# Run tests
npm test
```

### Scripts

- `npm run extract` - Extract schemas from botocore
- `npm test` - Run validation tests
- `npm run validate` - Validate generated schemas
- `npm run clean` - Clean generated files

## 📖 Schema Format

Each command schema follows this structure:

```json
{
  "command": "AddTagsToResourceCommand",
  "service": "elasticache",
  "operation": "AddTagsToResource",
  "generatedAt": "2025-01-15T10:30:00.000Z",
  "parameters": {
    "ResourceName": {
      "name": "ResourceName",
      "type": "string",
      "required": true,
      "documentation": "The Amazon Resource Name (ARN) of the resource..."
    },
    "Tags": {
      "name": "Tags",
      "type": "array", 
      "required": true,
      "documentation": "A list of tags to be added to this resource..."
    }
  },
  "requiredParameters": ["ResourceName", "Tags"],
  "optionalParameters": [],
  "parameterCount": 2,
  "summary": {
    "required": ["ResourceName (string)", "Tags (array)"],
    "optional": []
  }
}
```

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Ways to Contribute

- 🐛 **Report bugs** in schema extraction
- 💡 **Suggest improvements** to organization/format
- 📚 **Improve documentation**
- 🧪 **Add tests** for edge cases
- ⚡ **Optimize extraction** performance

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- **AWS/Boto3 Team** - For maintaining excellent service definitions
- **Botocore Project** - Source of truth for AWS API specifications
- **Community** - For feedback and contributions

## 📞 Support

- 🐛 **Bug reports**: [GitHub Issues](https://github.com/kamranbiglari/aws-sdk-schema-extractor/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/kamranbiglari/aws-sdk-schema-extractor/discussions)
- 📧 **Email**: your.email@example.com

---

⭐ **Star this repository** if it helps you work with AWS SDKs more efficiently!