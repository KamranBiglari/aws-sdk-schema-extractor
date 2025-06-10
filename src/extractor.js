import fs from 'fs/promises';
import path from 'path';

class Boto3ServiceJsonParser {
    constructor(botocoreDataPath) {
        this.botocoreDataPath = botocoreDataPath; // Path to cloned botocore/botocore/data
        this.schemas = {};
        this.errors = [];
        this.stats = {
            totalServices: 0,
            totalOperations: 0,
            successfulExtractions: 0,
            failedExtractions: 0
        };
    }

    /**
     * Parse all service-2.json files from botocore data directory
     */
    async parseAllServiceJsonFiles() {
        console.log('🚀 Starting Boto3 service-2.json Parser...\n');
        console.log(`📁 Reading from: ${this.botocoreDataPath}\n`);

        try {
            // Step 1: Find all services and their latest versions
            const services = await this.findAllServices();
            
            // Step 2: Parse each service's service-2.json file
            for (const serviceInfo of services) {
                await this.parseServiceJson(serviceInfo);
            }
            
            // Step 3: Save results
            await this.saveResults();
            
            console.log('✅ Boto3 service-2.json parsing complete!');
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Parsing failed:', error.message);
            throw error;
        }
    }

    /**
     * Find all services and get their latest API versions
     */
    async findAllServices() {
        console.log('🔍 Discovering services and API versions...');
        
        const services = [];
        
        try {
            const serviceDirectories = await fs.readdir(this.botocoreDataPath);
            
            for (const serviceName of serviceDirectories) {
                const servicePath = path.join(this.botocoreDataPath, serviceName);
                
                try {
                    const stat = await fs.stat(servicePath);
                    if (!stat.isDirectory()) continue;
                    
                    // Get latest API version for this service
                    const latestVersion = await this.getLatestApiVersion(servicePath);
                    
                    if (latestVersion) {
                        services.push({
                            name: serviceName,
                            version: latestVersion,
                            path: servicePath
                        });
                        console.log(`   ✅ Found: ${serviceName} (${latestVersion})`);
                    }
                    
                } catch (error) {
                    console.log(`   ⚠️ Skipped: ${serviceName} (${error.message})`);
                }
            }
            
        } catch (error) {
            throw new Error(`Could not read botocore data directory: ${error.message}`);
        }
        
        this.stats.totalServices = services.length;
        console.log(`📊 Found ${services.length} services total\n`);
        
        return services;
    }

    /**
     * Get the latest API version (YYYY-MM-DD) for a service
     */
    async getLatestApiVersion(servicePath) {
        try {
            const versionDirectories = await fs.readdir(servicePath);
            
            // Filter for YYYY-MM-DD format and get the latest
            const apiVersions = versionDirectories
                .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir))
                .sort()
                .reverse(); // Latest first
            
            return apiVersions[0] || null;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * Parse service-2.json file for a specific service
     */
    async parseServiceJson(serviceInfo) {
        console.log(`🔧 Parsing: ${serviceInfo.name} (${serviceInfo.version})`);
        
        const serviceJsonPath = path.join(serviceInfo.path, serviceInfo.version, 'service-2.json');
        
        try {
            // Read and parse the service-2.json file
            const serviceJsonContent = await fs.readFile(serviceJsonPath, 'utf8');
            const serviceModel = JSON.parse(serviceJsonContent);
            
            console.log(`   📋 Service: ${serviceModel.metadata?.serviceFullName || serviceInfo.name}`);
            console.log(`   🔗 Protocol: ${serviceModel.metadata?.protocol || 'unknown'}`);
            
            // Extract operations from the service model
            if (serviceModel.operations) {
                const operationNames = Object.keys(serviceModel.operations);
                console.log(`   ⚙️ Operations: ${operationNames.length}`);
                
                this.stats.totalOperations += operationNames.length;
                
                // Parse each operation
                for (const [operationName, operationDef] of Object.entries(serviceModel.operations)) {
                    try {
                        const commandSchema = await this.parseOperation(
                            serviceInfo.name,
                            operationName,
                            operationDef,
                            serviceModel.shapes || {}
                        );
                        
                        if (commandSchema) {
                            const commandName = operationName + 'Command';
                            this.schemas[commandName] = commandSchema;
                            this.stats.successfulExtractions++;
                        }
                        
                    } catch (error) {
                        console.log(`     ❌ Failed to parse ${operationName}: ${error.message}`);
                        this.errors.push({
                            service: serviceInfo.name,
                            operation: operationName,
                            error: error.message
                        });
                        this.stats.failedExtractions++;
                    }
                }
                
            } else {
                console.log(`   ⚠️ No operations found in service model`);
            }
            
        } catch (error) {
            console.log(`   ❌ Failed to parse service JSON: ${error.message}`);
            this.errors.push({
                service: serviceInfo.name,
                error: error.message
            });
        }
    }

    /**
     * Parse an individual operation to extract parameters
     */
    async parseOperation(serviceName, operationName, operationDef, shapes) {
        const parameters = {};
        const required = [];
        const optional = [];
        
        // Check if operation has input shape
        if (!operationDef.input || !operationDef.input.shape) {
            // No input parameters for this operation
            return {
                service: serviceName,
                operation: operationName,
                parameters: {},
                requiredParameters: [],
                optionalParameters: []
            };
        }
        
        const inputShapeName = operationDef.input.shape;
        const inputShape = shapes[inputShapeName];
        
        if (!inputShape) {
            throw new Error(`Input shape '${inputShapeName}' not found in shapes`);
        }
        
        console.log(`     📝 ${operationName}: Analyzing input shape '${inputShapeName}'`);
        
        // Parse shape members (parameters)
        if (inputShape.members) {
            for (const [paramName, paramDef] of Object.entries(inputShape.members)) {
                try {
                    const paramInfo = this.parseParameter(paramName, paramDef, shapes);
                    
                    // Check if parameter is required
                    const isRequired = inputShape.required && inputShape.required.includes(paramName);
                    
                    parameters[paramName] = {
                        name: paramName,
                        type: paramInfo.type,
                        required: isRequired,
                        documentation: paramInfo.documentation
                    };
                    
                    if (isRequired) {
                        required.push(paramName);
                    } else {
                        optional.push(paramName);
                    }
                    
                    console.log(`       ${isRequired ? '✓' : '○'} ${paramName}: ${paramInfo.type} ${isRequired ? '[REQUIRED]' : '[OPTIONAL]'}`);
                    
                } catch (error) {
                    console.log(`       ⚠️ Could not parse parameter ${paramName}: ${error.message}`);
                }
            }
        }
        
        return {
            service: serviceName,
            operation: operationName,
            parameters,
            requiredParameters: required,
            optionalParameters: optional,
            documentation: operationDef.documentation
        };
    }

    /**
     * Parse an individual parameter from shape definition
     */
    parseParameter(paramName, paramDef, shapes) {
        let paramType = 'unknown';
        let documentation = paramDef.documentation || '';
        
        if (paramDef.shape) {
            const shape = shapes[paramDef.shape];
            
            if (shape) {
                switch (shape.type) {
                    case 'string':
                        paramType = 'string';
                        break;
                    case 'integer':
                    case 'long':
                    case 'float':
                    case 'double':
                        paramType = 'number';
                        break;
                    case 'boolean':
                        paramType = 'boolean';
                        break;
                    case 'timestamp':
                        paramType = 'string'; // ISO date string
                        break;
                    case 'list':
                        paramType = 'array';
                        break;
                    case 'map':
                    case 'structure':
                        paramType = 'object';
                        break;
                    case 'blob':
                        paramType = 'string'; // Base64 encoded
                        break;
                    default:
                        paramType = shape.type || 'unknown';
                }
                
                // Use shape documentation if parameter doesn't have it
                if (!documentation && shape.documentation) {
                    documentation = shape.documentation;
                }
            }
        }
        
        return {
            type: paramType,
            documentation: this.cleanDocumentation(documentation)
        };
    }

    /**
     * Clean up AWS documentation (remove HTML tags, etc.)
     */
    cleanDocumentation(doc) {
        if (!doc) return '';
        
        return doc
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim()
            .substring(0, 200); // Limit length
    }

    /**
     * Save extracted schemas organized by service folders
     */
    async saveResults() {
        console.log('\n💾 Saving schemas organized by service...');
        
        // Create main output directory
        const outputDir = 'aws-schemas';
        await this.ensureDirectory(outputDir);
        
        // Group schemas by service
        const serviceGroups = {};
        for (const [commandName, schema] of Object.entries(this.schemas)) {
            const serviceName = schema.service;
            if (!serviceGroups[serviceName]) {
                serviceGroups[serviceName] = {};
            }
            serviceGroups[serviceName][commandName] = schema;
        }
        
        // Save each service to its own folder
        for (const [serviceName, serviceSchemas] of Object.entries(serviceGroups)) {
            await this.saveServiceSchemas(outputDir, serviceName, serviceSchemas);
        }
        
        // Create overall metadata and summary
        await this.saveOverallMetadata(outputDir);
        
        console.log(`✅ All schemas saved to organized folders in: ${outputDir}/`);
    }

    /**
     * Save schemas for a specific service
     */
    async saveServiceSchemas(outputDir, serviceName, serviceSchemas) {
        const serviceDir = path.join(outputDir, serviceName);
        await this.ensureDirectory(serviceDir);
        
        const commandCount = Object.keys(serviceSchemas).length;
        console.log(`   📁 ${serviceName}/ (${commandCount} commands)`);
        
        // Save each command as a separate file
        for (const [commandName, schema] of Object.entries(serviceSchemas)) {
            const commandFile = path.join(serviceDir, `${commandName}.json`);
            const commandData = {
                command: commandName,
                service: schema.service,
                operation: schema.operation,
                generatedAt: new Date().toISOString(),
                parameters: schema.parameters,
                requiredParameters: schema.requiredParameters,
                optionalParameters: schema.optionalParameters,
                documentation: schema.documentation || null,
                parameterCount: Object.keys(schema.parameters).length,
                summary: {
                    required: schema.requiredParameters.map(p => 
                        `${p} (${schema.parameters[p].type})`
                    ),
                    optional: schema.optionalParameters.map(p => 
                        `${p} (${schema.parameters[p].type})`
                    )
                }
            };
            
            await fs.writeFile(commandFile, JSON.stringify(commandData, null, 2), 'utf8');
            console.log(`     ✓ ${commandName}.json`);
        }
        
        // Create service summary file
        await this.createServiceSummary(serviceDir, serviceName, serviceSchemas);
    }

    /**
     * Create summary file for a service
     */
    async createServiceSummary(serviceDir, serviceName, serviceSchemas) {
        const serviceSummary = {
            service: serviceName,
            generatedAt: new Date().toISOString(),
            totalCommands: Object.keys(serviceSchemas).length,
            commands: {}
        };
        
        // Add command summaries
        for (const [commandName, schema] of Object.entries(serviceSchemas)) {
            serviceSummary.commands[commandName] = {
                operation: schema.operation,
                parameterCount: Object.keys(schema.parameters).length,
                requiredCount: schema.requiredParameters.length,
                optionalCount: schema.optionalParameters.length,
                required: schema.requiredParameters,
                optional: schema.optionalParameters
            };
        }
        
        const summaryFile = path.join(serviceDir, '_service-summary.json');
        await fs.writeFile(summaryFile, JSON.stringify(serviceSummary, null, 2), 'utf8');
        console.log(`     📋 _service-summary.json`);
    }

    /**
     * Save overall metadata and create index
     */
    async saveOverallMetadata(outputDir) {
        // Create main index file
        const indexData = {
            generatedAt: new Date().toISOString(),
            generator: 'Boto3ServiceJsonParser',
            version: '1.0.0',
            source: 'BOTOCORE_SERVICE_2_JSON_FILES',
            botocoreDataPath: this.botocoreDataPath,
            stats: this.stats,
            organization: 'BY_SERVICE_FOLDERS',
            structure: {
                description: 'Each service has its own folder with individual command files',
                example: 'aws-schemas/elasticache/AddTagsToResourceCommand.json'
            },
            services: {},
            errors: this.errors
        };
        
        // Group by service for index
        for (const [commandName, schema] of Object.entries(this.schemas)) {
            const serviceName = schema.service;
            if (!indexData.services[serviceName]) {
                indexData.services[serviceName] = {
                    commandCount: 0,
                    commands: []
                };
            }
            indexData.services[serviceName].commandCount++;
            indexData.services[serviceName].commands.push(commandName);
        }
        
        const indexFile = path.join(outputDir, 'index.json');
        await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2), 'utf8');
        console.log(`   📋 index.json (main index)`);
        
        // Create README
        await this.createReadme(outputDir, indexData);
    }

    /**
     * Create README file explaining the structure
     */
    async createReadme(outputDir, indexData) {
        const readmeContent = `# AWS Command Schemas

Generated from boto3 service-2.json files

## Structure

\`\`\`
aws-schemas/
├── index.json                           # Main index of all services
├── README.md                           # This file
├── elasticache/                        # ElastiCache service
│   ├── _service-summary.json          # Service summary
│   ├── AddTagsToResourceCommand.json  # Individual command
│   ├── DescribeCacheClustersCommand.json
│   └── ...
├── ec2/                               # EC2 service
│   ├── _service-summary.json
│   ├── RunInstancesCommand.json
│   └── ...
└── s3/                                # S3 service
    ├── _service-summary.json
    ├── PutObjectCommand.json
    └── ...
\`\`\`

## Usage

### Load a specific command:
\`\`\`javascript
const addTagsSchema = JSON.parse(fs.readFileSync('aws-schemas/elasticache/AddTagsToResourceCommand.json'));
console.log(addTagsSchema.requiredParameters); // ["ResourceName", "Tags"]
\`\`\`

### Load service summary:
\`\`\`javascript
const elasticacheSummary = JSON.parse(fs.readFileSync('aws-schemas/elasticache/_service-summary.json'));
console.log(elasticacheSummary.totalCommands); // Number of commands
\`\`\`

## Statistics

- **Total Services**: ${indexData.stats.totalServices}
- **Total Operations**: ${indexData.stats.totalOperations}
- **Successful Extractions**: ${indexData.stats.successfulExtractions}
- **Failed Extractions**: ${indexData.stats.failedExtractions}

## Services

${Object.entries(indexData.services)
  .map(([serviceName, serviceInfo]) => 
    `- **${serviceName}**: ${serviceInfo.commandCount} commands`
  ).join('\n')}

## Generated

- **Date**: ${indexData.generatedAt}
- **Source**: ${indexData.source}
- **Generator**: ${indexData.generator}
`;

        const readmeFile = path.join(outputDir, 'README.md');
        await fs.writeFile(readmeFile, readmeContent, 'utf8');
        console.log(`   📖 README.md`);
    }

    /**
     * Ensure directory exists
     */
    async ensureDirectory(dirPath) {
        try {
            await fs.access(dirPath);
        } catch (error) {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * Create summary file
     */
    async createSummaryFile(data) {
        const summary = {
            generatedAt: data.generatedAt,
            source: data.source,
            stats: data.stats,
            services: {},
            quickReference: {}
        };

        // Group by service
        for (const [commandName, schema] of Object.entries(data.schemas)) {
            if (!summary.services[schema.service]) {
                summary.services[schema.service] = [];
            }
            summary.services[schema.service].push(commandName);
            
            // Quick reference
            summary.quickReference[commandName] = {
                service: schema.service,
                operation: schema.operation,
                totalParams: Object.keys(schema.parameters).length,
                required: schema.requiredParameters,
                optional: schema.optionalParameters
            };
        }

        const summaryContent = JSON.stringify(summary, null, 2);
        await fs.writeFile('aws-boto3-summary.json', summaryContent, 'utf8');
    }

    /**
     * Print parsing summary
     */
    printSummary() {
        console.log('\n📊 BOTO3 SERVICE-2.JSON PARSING SUMMARY:');
        console.log(`🏗️  Services processed: ${this.stats.totalServices}`);
        console.log(`⚙️  Operations found: ${this.stats.totalOperations}`);
        console.log(`✅ Successful extractions: ${this.stats.successfulExtractions}`);
        console.log(`❌ Failed extractions: ${this.stats.failedExtractions}`);
        
        // Show service breakdown
        const serviceBreakdown = {};
        for (const [commandName, schema] of Object.entries(this.schemas)) {
            const serviceName = schema.service;
            if (!serviceBreakdown[serviceName]) {
                serviceBreakdown[serviceName] = 0;
            }
            serviceBreakdown[serviceName]++;
        }
        
        console.log('\n📋 Commands per service:');
        Object.entries(serviceBreakdown)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .forEach(([service, count]) => {
                console.log(`   ${service}: ${count} commands`);
            });
        
        console.log('\n🎉 Schemas organized by service folders!');
    }

    /**
     * Create runtime loader for organized schema files
     */
    static createRuntimeLoader(schemasBasePath = './aws-schemas') {
        return {
            schemasPath: schemasBasePath,
            
            async loadServiceIndex() {
                try {
                    const indexPath = path.join(this.schemasPath, 'index.json');
                    const data = await fs.readFile(indexPath, 'utf8');
                    return JSON.parse(data);
                } catch (error) {
                    console.error('Failed to load service index:', error.message);
                    return null;
                }
            },

            async getAvailableServices() {
                const index = await this.loadServiceIndex();
                return index ? Object.keys(index.services) : [];
            },

            async getServiceSummary(serviceName) {
                try {
                    const summaryPath = path.join(this.schemasPath, serviceName, '_service-summary.json');
                    const data = await fs.readFile(summaryPath, 'utf8');
                    return JSON.parse(data);
                } catch (error) {
                    console.error(`Failed to load ${serviceName} summary:`, error.message);
                    return null;
                }
            },

            async getCommandSchema(commandName, serviceName = null) {
                try {
                    // If service name provided, look directly
                    if (serviceName) {
                        const commandPath = path.join(this.schemasPath, serviceName, `${commandName}.json`);
                        const data = await fs.readFile(commandPath, 'utf8');
                        return JSON.parse(data);
                    }
                    
                    // Otherwise, search across all services
                    const services = await this.getAvailableServices();
                    
                    for (const service of services) {
                        try {
                            const commandPath = path.join(this.schemasPath, service, `${commandName}.json`);
                            const data = await fs.readFile(commandPath, 'utf8');
                            return JSON.parse(data);
                        } catch (error) {
                            // Command not in this service, continue searching
                            continue;
                        }
                    }
                    
                    return null; // Command not found in any service
                    
                } catch (error) {
                    console.error(`Failed to load command ${commandName}:`, error.message);
                    return null;
                }
            },

            async getCommandParameters(commandName, serviceName = null) {
                const schema = await this.getCommandSchema(commandName, serviceName);
                
                if (!schema) return null;
                
                return {
                    required: schema.summary.required.map(p => `${p} Required`),
                    optional: schema.summary.optional.map(p => `${p} Optional`),
                    schema
                };
            },

            async getServiceCommands(serviceName) {
                const summary = await this.getServiceSummary(serviceName);
                return summary ? Object.keys(summary.commands) : [];
            },

            async searchCommands(searchTerm) {
                const results = [];
                const services = await this.getAvailableServices();
                
                for (const serviceName of services) {
                    const commands = await this.getServiceCommands(serviceName);
                    
                    for (const commandName of commands) {
                        if (commandName.toLowerCase().includes(searchTerm.toLowerCase())) {
                            results.push({
                                command: commandName,
                                service: serviceName
                            });
                        }
                    }
                }
                
                return results;
            }
        };
    }
}

// Usage function with path configuration
async function runBoto3JsonParser() {
    console.log('🎯 Boto3 service-2.json Parser\n');
    
    // CONFIGURE THIS PATH - Point to your cloned botocore data directory
    const BOTOCORE_DATA_PATH = process.env.BOTOCORE_DATA_PATH || './botocore/botocore/data';
    
    console.log('📋 SETUP INSTRUCTIONS:');
    console.log('1. Clone botocore repository:');
    console.log('   git clone https://github.com/boto/botocore.git');
    console.log('2. Set the path below to: ./botocore/botocore/data');
    console.log('3. Run this script\n');
    console.log(`Current path: ${BOTOCORE_DATA_PATH}\n`);
    
    try {
        // Check if path exists
        await fs.access(BOTOCORE_DATA_PATH);
        
        const parser = new Boto3ServiceJsonParser(BOTOCORE_DATA_PATH);
        await parser.parseAllServiceJsonFiles();
        
        // Test the organized loader
        console.log('\n🧪 Testing organized schema loader...');
        const loader = Boto3ServiceJsonParser.createRuntimeLoader('./aws-schemas');
        
        // Test service listing
        const services = await loader.getAvailableServices();
        console.log(`\n📋 Available services: ${services.length}`);
        console.log('Services:', services.slice(0, 5).join(', ') + (services.length > 5 ? '...' : ''));
        
        // Test specific command loading
        const addTagsResult = await loader.getCommandParameters('AddTagsToResourceCommand', 'elasticache');
        if (addTagsResult) {
            console.log('\n📄 AddTagsToResourceCommand (from elasticache/AddTagsToResourceCommand.json):');
            console.log('  Required:', addTagsResult.required);
            console.log('  Optional:', addTagsResult.optional);
        }
        
        // Test service summary
        if (services.includes('elasticache')) {
            const elasticacheSummary = await loader.getServiceSummary('elasticache');
            if (elasticacheSummary) {
                console.log(`\n📊 ElastiCache service summary:`);
                console.log(`  Total commands: ${elasticacheSummary.totalCommands}`);
                console.log(`  Example commands: ${Object.keys(elasticacheSummary.commands).slice(0, 3).join(', ')}`);
            }
        }
        
        // Test command search
        const tagCommands = await loader.searchCommands('Tag');
        console.log(`\n🔍 Commands containing 'Tag': ${tagCommands.length}`);
        tagCommands.slice(0, 3).forEach(result => {
            console.log(`  - ${result.command} (${result.service})`);
        });
        
        console.log('\n✅ Organized schema structure created successfully!');
        console.log('\n📁 Directory structure:');
        console.log('aws-schemas/');
        console.log('├── index.json');
        console.log('├── README.md'); 
        services.slice(0, 3).forEach(service => {
            console.log(`├── ${service}/`);
            console.log(`│   ├── _service-summary.json`);
            console.log(`│   ├── [CommandName].json`);
            console.log(`│   └── ...`);
        });
        if (services.length > 3) {
            console.log('└── ...');
        }
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`❌ Botocore data path not found: ${BOTOCORE_DATA_PATH}`);
            console.error('\n📋 Setup instructions:');
            console.error('1. Clone: git clone https://github.com/boto/botocore.git');
            console.error('2. Update BOTOCORE_DATA_PATH to point to: ./botocore/botocore/data');
            console.error('3. Or set environment variable: BOTOCORE_DATA_PATH=./botocore/botocore/data');
        } else {
            console.error('❌ Parser failed:', error.message);
        }
    }
}

export { Boto3ServiceJsonParser };

// Run the parser
runBoto3JsonParser();