import fs from 'fs/promises';
import path from 'path';

class SchemaValidator {
    constructor(schemasPath = './aws-schemas') {
        this.schemasPath = schemasPath;
        this.validationErrors = [];
        this.validationWarnings = [];
        this.stats = {
            totalFiles: 0,
            validFiles: 0,
            invalidFiles: 0,
            totalCommands: 0,
            totalServices: 0
        };
    }

    /**
     * Validate all extracted schemas
     */
    async validateAllSchemas() {
        console.log('🔍 Starting schema validation...\n');
        
        try {
            // Check if schemas directory exists
            await this.checkSchemasDirectory();
            
            // Validate index file
            await this.validateIndexFile();
            
            // Validate all service directories
            await this.validateAllServices();
            
            // Print validation results
            this.printValidationResults();
            
            return this.validationErrors.length === 0;
            
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            return false;
        }
    }

    /**
     * Check if schemas directory exists
     */
    async checkSchemasDirectory() {
        try {
            const stat = await fs.stat(this.schemasPath);
            if (!stat.isDirectory()) {
                throw new Error(`${this.schemasPath} is not a directory`);
            }
            console.log(`✅ Schemas directory found: ${this.schemasPath}`);
        } catch (error) {
            throw new Error(`Schemas directory not found: ${this.schemasPath}`);
        }
    }

    /**
     * Validate main index file
     */
    async validateIndexFile() {
        console.log('📋 Validating index file...');
        
        const indexPath = path.join(this.schemasPath, 'index.json');
        
        try {
            const indexContent = await fs.readFile(indexPath, 'utf8');
            const indexData = JSON.parse(indexContent);
            
            // Validate index structure
            const requiredFields = ['generatedAt', 'generator', 'stats', 'services'];
            for (const field of requiredFields) {
                if (!(field in indexData)) {
                    this.addError(`Index file missing required field: ${field}`);
                }
            }
            
            // Validate stats
            if (indexData.stats) {
                const requiredStats = ['totalServices', 'totalOperations', 'successfulExtractions'];
                for (const stat of requiredStats) {
                    if (!(stat in indexData.stats)) {
                        this.addWarning(`Index stats missing field: ${stat}`);
                    }
                }
                
                this.stats.totalServices = indexData.stats.totalServices || 0;
                console.log(`   📊 Index reports ${this.stats.totalServices} services`);
            }
            
            // Validate services list
            if (indexData.services && typeof indexData.services === 'object') {
                this.stats.totalCommands = Object.values(indexData.services)
                    .reduce((total, service) => total + (service.commandCount || 0), 0);
                console.log(`   📊 Index reports ${this.stats.totalCommands} total commands`);
            }
            
            console.log('   ✅ Index file is valid');
            
        } catch (error) {
            this.addError(`Invalid index file: ${error.message}`);
        }
    }

    /**
     * Validate all service directories and their files
     */
    async validateAllServices() {
        console.log('\n🔧 Validating service directories...');
        
        try {
            const entries = await fs.readdir(this.schemasPath);
            const serviceDirs = [];
            
            for (const entry of entries) {
                const entryPath = path.join(this.schemasPath, entry);
                const stat = await fs.stat(entryPath);
                
                if (stat.isDirectory()) {
                    serviceDirs.push(entry);
                }
            }
            
            console.log(`   📁 Found ${serviceDirs.length} service directories`);
            
            for (const serviceDir of serviceDirs) {
                await this.validateService(serviceDir);
            }
            
        } catch (error) {
            this.addError(`Could not read schemas directory: ${error.message}`);
        }
    }

    /**
     * Validate a specific service directory
     */
    async validateService(serviceName) {
        console.log(`   🔍 Validating service: ${serviceName}`);
        
        const servicePath = path.join(this.schemasPath, serviceName);
        
        try {
            // Check for service summary file
            await this.validateServiceSummary(servicePath, serviceName);
            
            // Validate all command files in service
            await this.validateServiceCommands(servicePath, serviceName);
            
        } catch (error) {
            this.addError(`Service ${serviceName} validation failed: ${error.message}`);
        }
    }

    /**
     * Validate service summary file
     */
    async validateServiceSummary(servicePath, serviceName) {
        const summaryPath = path.join(servicePath, '_service-summary.json');
        
        try {
            const summaryContent = await fs.readFile(summaryPath, 'utf8');
            const summaryData = JSON.parse(summaryContent);
            
            // Validate summary structure
            const requiredFields = ['service', 'generatedAt', 'totalCommands', 'commands'];
            for (const field of requiredFields) {
                if (!(field in summaryData)) {
                    this.addError(`Service ${serviceName} summary missing field: ${field}`);
                }
            }
            
            // Check service name matches directory
            if (summaryData.service !== serviceName) {
                this.addError(`Service ${serviceName} summary has wrong service name: ${summaryData.service}`);
            }
            
            console.log(`     📋 Summary: ${summaryData.totalCommands || 0} commands`);
            
        } catch (error) {
            this.addError(`Service ${serviceName} missing or invalid summary: ${error.message}`);
        }
    }

    /**
     * Validate all command files in a service
     */
    async validateServiceCommands(servicePath, serviceName) {
        try {
            const files = await fs.readdir(servicePath);
            const commandFiles = files.filter(file => 
                file.endsWith('.json') && !file.startsWith('_')
            );
            
            let validCommands = 0;
            
            for (const commandFile of commandFiles) {
                const isValid = await this.validateCommandFile(servicePath, serviceName, commandFile);
                if (isValid) {
                    validCommands++;
                }
                this.stats.totalFiles++;
            }
            
            console.log(`     ✅ ${validCommands}/${commandFiles.length} command files valid`);
            this.stats.validFiles += validCommands;
            this.stats.invalidFiles += (commandFiles.length - validCommands);
            
        } catch (error) {
            this.addError(`Could not read service ${serviceName} files: ${error.message}`);
        }
    }

    /**
     * Validate individual command file
     */
    async validateCommandFile(servicePath, serviceName, commandFile) {
        const commandPath = path.join(servicePath, commandFile);
        const commandName = commandFile.replace('.json', '');
        
        try {
            const commandContent = await fs.readFile(commandPath, 'utf8');
            const commandData = JSON.parse(commandContent);
            
            // Validate command structure
            const requiredFields = ['command', 'service', 'operation', 'parameters', 'requiredParameters', 'optionalParameters'];
            let isValid = true;
            
            for (const field of requiredFields) {
                if (!(field in commandData)) {
                    this.addError(`Command ${serviceName}/${commandName} missing field: ${field}`);
                    isValid = false;
                }
            }
            
            // Validate service name matches
            if (commandData.service !== serviceName) {
                this.addError(`Command ${serviceName}/${commandName} has wrong service: ${commandData.service}`);
                isValid = false;
            }
            
            // Validate command name matches file
            if (commandData.command !== commandName) {
                this.addError(`Command ${serviceName}/${commandName} has wrong command name: ${commandData.command}`);
                isValid = false;
            }
            
            // Validate parameters structure
            if (commandData.parameters && typeof commandData.parameters === 'object') {
                for (const [paramName, paramInfo] of Object.entries(commandData.parameters)) {
                    if (!this.validateParameter(paramName, paramInfo, `${serviceName}/${commandName}`)) {
                        isValid = false;
                    }
                }
            }
            
            // Validate parameter consistency
            if (commandData.requiredParameters && commandData.optionalParameters && commandData.parameters) {
                const allParams = [...commandData.requiredParameters, ...commandData.optionalParameters];
                const definedParams = Object.keys(commandData.parameters);
                
                // Check for missing parameter definitions
                for (const param of allParams) {
                    if (!definedParams.includes(param)) {
                        this.addWarning(`Command ${serviceName}/${commandName} lists parameter ${param} but no definition found`);
                        isValid = false;
                    }
                }
                
                // Check for extra parameter definitions (not necessarily an error, just a warning)
                for (const param of definedParams) {
                    if (!allParams.includes(param)) {
                        this.addWarning(`Command ${serviceName}/${commandName} defines parameter ${param} but not in required/optional lists`);
                    }
                }
                
                // Check for duplicates between required and optional
                const duplicates = commandData.requiredParameters.filter(param => 
                    commandData.optionalParameters.includes(param)
                );
                if (duplicates.length > 0) {
                    this.addError(`Command ${serviceName}/${commandName} has duplicate parameters in required/optional: ${duplicates.join(', ')}`);
                    isValid = false;
                }
            }
            
            return isValid;
            
        } catch (error) {
            this.addError(`Command ${serviceName}/${commandName} invalid JSON: ${error.message}`);
            return false;
        }
    }

    /**
     * Validate individual parameter
     */
    validateParameter(paramName, paramInfo, commandPath) {
        const requiredFields = ['name', 'type'];  // Removed 'required' from here
        let isValid = true;
        
        for (const field of requiredFields) {
            if (!(field in paramInfo)) {
                this.addError(`Parameter ${commandPath}:${paramName} missing field: ${field}`);
                isValid = false;
            }
        }
        
        // Validate parameter name matches key
        if (paramInfo.name !== paramName) {
            this.addError(`Parameter ${commandPath}:${paramName} has wrong name: ${paramInfo.name}`);
            isValid = false;
        }
        
        // Validate type
        const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'null', 'undefined'];
        if (paramInfo.type && !validTypes.includes(paramInfo.type)) {
            this.addWarning(`Parameter ${commandPath}:${paramName} has unusual type: ${paramInfo.type}`);
        }
        
        // Note: 'required' field is optional in parameter objects since we get this info from requiredParameters/optionalParameters arrays
        if (paramInfo.hasOwnProperty('required') && typeof paramInfo.required !== 'boolean') {
            this.addError(`Parameter ${commandPath}:${paramName} required field must be boolean, got: ${typeof paramInfo.required}`);
            isValid = false;
        }
        
        return isValid;
    }

    /**
     * Add validation error
     */
    addError(message) {
        this.validationErrors.push(message);
        console.log(`     ❌ ERROR: ${message}`);
    }

    /**
     * Add validation warning
     */
    addWarning(message) {
        this.validationWarnings.push(message);
        console.log(`     ⚠️ WARNING: ${message}`);
    }

    /**
     * Print validation results
     */
    printValidationResults() {
        console.log('\n📊 VALIDATION RESULTS:');
        console.log(`🏗️  Total files checked: ${this.stats.totalFiles}`);
        console.log(`✅ Valid files: ${this.stats.validFiles}`);
        console.log(`❌ Invalid files: ${this.stats.invalidFiles}`);
        console.log(`⚠️  Warnings: ${this.validationWarnings.length}`);
        console.log(`🚨 Errors: ${this.validationErrors.length}`);
        
        if (this.validationErrors.length > 0) {
            console.log('\n❌ VALIDATION ERRORS:');
            this.validationErrors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        if (this.validationWarnings.length > 0 && this.validationWarnings.length <= 10) {
            console.log('\n⚠️ VALIDATION WARNINGS:');
            this.validationWarnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning}`);
            });
        } else if (this.validationWarnings.length > 10) {
            console.log(`\n⚠️ ${this.validationWarnings.length} warnings (showing first 5):`);
            this.validationWarnings.slice(0, 5).forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning}`);
            });
        }
        
        if (this.validationErrors.length === 0) {
            console.log('\n🎉 All schemas are valid!');
        } else {
            console.log('\n💥 Schema validation failed!');
        }
    }

    /**
     * Validate single command schema (for programmatic use)
     */
    static validateCommandSchema(schema) {
        const requiredFields = ['command', 'service', 'operation', 'parameters', 'requiredParameters', 'optionalParameters'];
        
        for (const field of requiredFields) {
            if (!(field in schema)) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }
        
        // Validate parameters
        if (schema.parameters && typeof schema.parameters === 'object') {
            for (const [paramName, paramInfo] of Object.entries(schema.parameters)) {
                const paramFields = ['name', 'type'];  // Removed 'required' from required fields
                for (const field of paramFields) {
                    if (!(field in paramInfo)) {
                        return { valid: false, error: `Parameter ${paramName} missing field: ${field}` };
                    }
                }
                
                // Only validate 'required' field if it exists
                if (paramInfo.hasOwnProperty('required') && typeof paramInfo.required !== 'boolean') {
                    return { valid: false, error: `Parameter ${paramName} required field must be boolean` };
                }
            }
        }
        
        // Validate that requiredParameters and optionalParameters are arrays
        if (!Array.isArray(schema.requiredParameters)) {
            return { valid: false, error: 'requiredParameters must be an array' };
        }
        
        if (!Array.isArray(schema.optionalParameters)) {
            return { valid: false, error: 'optionalParameters must be an array' };
        }
        
        // Validate parameter consistency - all parameters in arrays should be defined in parameters object
        const allParamNames = [...schema.requiredParameters, ...schema.optionalParameters];
        const definedParams = Object.keys(schema.parameters || {});
        
        for (const paramName of allParamNames) {
            if (!definedParams.includes(paramName)) {
                return { valid: false, error: `Parameter ${paramName} listed in required/optional but not defined in parameters` };
            }
        }
        
        return { valid: true };
    }
}

// Export for use in other modules
export { SchemaValidator };

// CLI usage
async function main() {
    const schemasPath = process.env.SCHEMAS_PATH || './aws-schemas';
    const validator = new SchemaValidator(schemasPath);
    
    const isValid = await validator.validateAllSchemas();
    
    // Exit with appropriate code for CI/CD
    process.exit(isValid ? 0 : 1);
}

// Run if called directly
    main().catch(error => {
        console.error('❌ Validation script failed:', error.message);
        process.exit(1);
    });
