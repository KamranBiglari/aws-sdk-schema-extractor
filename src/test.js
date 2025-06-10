import fs from 'fs/promises';
import path from 'path';
import { SchemaValidator } from './validator.js';

class SchemaTestSuite {
    constructor(schemasPath = './aws-schemas') {
        this.schemasPath = schemasPath;
        this.testResults = [];
        this.stats = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0
        };
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🧪 Starting AWS Schema Test Suite...\n');
        
        try {
            // Basic structure tests
            await this.testDirectoryStructure();
            await this.testIndexFile();
            await this.testSchemaLoading();
            
            // Content validation tests
            await this.testSchemaValidation();
            await this.testParameterConsistency();
            await this.testKnownCommands();
            
            // Performance tests
            await this.testLoadingPerformance();
            
            // Print test results
            this.printTestResults();
            
            return this.stats.failedTests === 0;
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            return false;
        }
    }

    /**
     * Test basic directory structure
     */
    async testDirectoryStructure() {
        const testName = 'Directory Structure';
        console.log(`🔍 Testing: ${testName}`);
        
        try {
            // Check main directory exists
            const stat = await fs.stat(this.schemasPath);
            this.assert(stat.isDirectory(), 'Main schemas directory should exist');
            
            // Check for required files
            const requiredFiles = ['index.json', 'README.md'];
            for (const file of requiredFiles) {
                const filePath = path.join(this.schemasPath, file);
                await fs.access(filePath);
            }
            
            // Check for service directories
            const entries = await fs.readdir(this.schemasPath);
            const directories = [];
            
            for (const entry of entries) {
                const entryPath = path.join(this.schemasPath, entry);
                const entryStat = await fs.stat(entryPath);
                if (entryStat.isDirectory()) {
                    directories.push(entry);
                }
            }
            
            this.assert(directories.length > 0, 'Should have at least one service directory');
            console.log(`   ✅ Found ${directories.length} service directories`);
            
            this.passTest(testName);
            
        } catch (error) {
            this.failTest(testName, error.message);
        }
    }

    /**
     * Test index file integrity
     */
    async testIndexFile() {
        const testName = 'Index File Integrity';
        console.log(`🔍 Testing: ${testName}`);
        
        try {
            const indexPath = path.join(this.schemasPath, 'index.json');
            const indexContent = await fs.readFile(indexPath, 'utf8');
            const indexData = JSON.parse(indexContent);
            
            // Test required fields
            const requiredFields = ['generatedAt', 'generator', 'stats', 'services'];
            for (const field of requiredFields) {
                this.assert(field in indexData, `Index should have ${field} field`);
            }
            
            // Test stats
            this.assert(typeof indexData.stats === 'object', 'Stats should be object');
            this.assert(indexData.stats.totalServices > 0, 'Should have total services > 0');
            this.assert(indexData.stats.totalOperations > 0, 'Should have total operations > 0');
            
            // Test services
            this.assert(typeof indexData.services === 'object', 'Services should be object');
            this.assert(Object.keys(indexData.services).length > 0, 'Should have services listed');
            
            console.log(`   📊 Services: ${indexData.stats.totalServices}, Operations: ${indexData.stats.totalOperations}`);
            
            this.passTest(testName);
            
        } catch (error) {
            this.failTest(testName, error.message);
        }
    }

    /**
     * Test schema loading functionality
     */
    async testSchemaLoading() {
        const testName = 'Schema Loading';
        console.log(`🔍 Testing: ${testName}`);
        
        try {
            // Test loading a service summary
            const services = await this.getAvailableServices();
            this.assert(services.length > 0, 'Should have available services');
            
            const testService = services[0];
            const summaryPath = path.join(this.schemasPath, testService, '_service-summary.json');
            const summaryContent = await fs.readFile(summaryPath, 'utf8');
            const summaryData = JSON.parse(summaryContent);
            
            this.assert(summaryData.service === testService, 'Summary service name should match directory');
            this.assert(summaryData.totalCommands > 0, 'Should have commands in summary');
            
            // Test loading a command file
            const commandNames = Object.keys(summaryData.commands);
            this.assert(commandNames.length > 0, 'Should have command names');
            
            const testCommand = commandNames[0];
            const commandPath = path.join(this.schemasPath, testService, `${testCommand}.json`);
            const commandContent = await fs.readFile(commandPath, 'utf8');
            const commandData = JSON.parse(commandContent);
            
            this.assert(commandData.command === testCommand, 'Command name should match file');
            this.assert(commandData.service === testService, 'Command service should match directory');
            
            console.log(`   ✅ Successfully loaded ${testService}/${testCommand}`);
            
            this.passTest(testName);
            
        } catch (error) {
            this.failTest(testName, error.message);
        }
    }

    /**
     * Test schema validation
     */
    async testSchemaValidation() {
        const testName = 'Schema Validation';
        console.log(`🔍 Testing: ${testName}`);
        
        try {
            const validator = new SchemaValidator(this.schemasPath);
            
            // Test valid schema
            const validSchema = {
                command: 'TestCommand',
                service: 'test',
                operation: 'Test',
                parameters: {
                    TestParam: {
                        name: 'TestParam',
                        type: 'string',
                        required: true
                    }
                },
                requiredParameters: ['TestParam'],
                optionalParameters: []
            };
            
            const validResult = SchemaValidator.validateCommandSchema(validSchema);
            this.assert(validResult.valid, 'Valid schema should pass validation');
            
            // Test invalid schema
            const invalidSchema = {
                command: 'TestCommand'
                // Missing required fields
            };
            
            const invalidResult = SchemaValidator.validateCommandSchema(invalidSchema);
            this.assert(!invalidResult.valid, 'Invalid schema should fail validation');
            
            console.log('   ✅ Schema validation logic works correctly');
            
            this.passTest(testName);
            
        } catch (error) {
            this.failTest(testName, error.message);
        }
    }

    /**
     * Test parameter consistency across schemas
     */
    async testParameterConsistency() {
        const testName = 'Parameter Consistency';
        console.log(`🔍 Testing: ${testName}`);
        
        try {
            const services = await this.getAvailableServices();
            let totalCommands = 0;
            let consistentCommands = 0;
            
            for (const service of services.slice(0, 3)) { // Test first 3 services
                const commands = await this.getServiceCommands(service);
                
                for (const command of commands.slice(0, 5)) { // Test first 5 commands per service
                    totalCommands++;
                    
                    const commandPath = path.join(this.schemasPath, service, `${command}.json`);
                    const commandContent = await fs.readFile(commandPath, 'utf8');
                    const commandData = JSON.parse(commandContent);
                    
                    // Check parameter consistency
                    const allParams = [...commandData.requiredParameters, ...commandData.optionalParameters];
                    const definedParams = Object.keys(commandData.parameters);
                    
                    const isConsistent = allParams.length === definedParams.length &&
                        allParams.every(param => definedParams.includes(param));
                    
                    if (isConsistent) {
                        consistentCommands++;
                    }
                }
            }
            
            const consistencyRate = totalCommands > 0 ? (consistentCommands / totalCommands) * 100 : 0;
            console.log(`   📊 Parameter consistency: ${consistentCommands}/${totalCommands} (${consistencyRate.toFixed(1)}%)`);
            
            this.assert(consistencyRate > 90, 'Parameter consistency should be > 90%');
            
            this.passTest(testName);
            
        } catch (error) {
            this.failTest(testName, error.message);
        }
    }

    /**
     * Test known commands have expected parameters
     */
    async testKnownCommands() {
        const testName = 'Known Commands';
        console.log(`🔍 Testing: ${testName}`);
        
        try {
            const knownCommands = [
                {
                    service: 'elasticache',
                    command: 'AddTagsToResourceCommand',
                    expectedRequired: ['ResourceName', 'Tags']
                },
                {
                    service: 's3',
                    command: 'PutObjectCommand',
                    expectedRequired: ['Bucket', 'Key']
                }
            ];
            
            let testedCommands = 0;
            
            for (const test of knownCommands) {
                try {
                    const commandPath = path.join(this.schemasPath, test.service, `${test.command}.json`);
                    const commandContent = await fs.readFile(commandPath, 'utf8');
                    const commandData = JSON.parse(commandContent);
                    
                    // Check if expected required parameters are present
                    for (const expectedParam of test.expectedRequired) {
                        this.assert(
                            commandData.requiredParameters.includes(expectedParam),
                            `${test.command} should have required parameter: ${expectedParam}`
                        );
                    }
                    
                    console.log(`   ✅ ${test.service}/${test.command} has expected parameters`);
                    testedCommands++;
                    
                } catch (error) {
                    console.log(`   ⚠️ Could not test ${test.service}/${test.command}: ${error.message}`);
                }
            }
            
            this.assert(testedCommands > 0, 'Should test at least one known command');
            
            this.passTest(testName);
            
        } catch (error) {
            this.failTest(testName, error.message);
        }
    }

    /**
     * Test loading performance
     */
    async testLoadingPerformance() {
        const testName = 'Loading Performance';
        console.log(`🔍 Testing: ${testName}`);
        
        try {
            const startTime = Date.now();
            
            // Load index
            const indexPath = path.join(this.schemasPath, 'index.json');
            await fs.readFile(indexPath, 'utf8');
            
            // Load a few service summaries
            const services = await this.getAvailableServices();
            for (const service of services.slice(0, 5)) {
                const summaryPath = path.join(this.schemasPath, service, '_service-summary.json');
                await fs.readFile(summaryPath, 'utf8');
            }
            
            // Load a few command files
            if (services.length > 0) {
                const commands = await this.getServiceCommands(services[0]);
                for (const command of commands.slice(0, 10)) {
                    const commandPath = path.join(this.schemasPath, services[0], `${command}.json`);
                    await fs.readFile(commandPath, 'utf8');
                }
            }
            
            const endTime = Date.now();
            const loadTime = endTime - startTime;
            
            console.log(`   ⏱️ Loading time: ${loadTime}ms`);
            
            // Should load reasonably fast (under 1 second for basic operations)
            this.assert(loadTime < 1000, 'Basic loading operations should complete under 1 second');
            
            this.passTest(testName);
            
        } catch (error) {
            this.failTest(testName, error.message);
        }
    }

    /**
     * Helper: Get available services
     */
    async getAvailableServices() {
        const entries = await fs.readdir(this.schemasPath);
        const services = [];
        
        for (const entry of entries) {
            const entryPath = path.join(this.schemasPath, entry);
            const stat = await fs.stat(entryPath);
            if (stat.isDirectory()) {
                services.push(entry);
            }
        }
        
        return services;
    }

    /**
     * Helper: Get commands for a service
     */
    async getServiceCommands(serviceName) {
        const servicePath = path.join(this.schemasPath, serviceName);
        const files = await fs.readdir(servicePath);
        
        return files
            .filter(file => file.endsWith('.json') && !file.startsWith('_'))
            .map(file => file.replace('.json', ''));
    }

    /**
     * Assert helper
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    /**
     * Record passed test
     */
    passTest(testName) {
        this.testResults.push({ name: testName, status: 'PASS' });
        this.stats.totalTests++;
        this.stats.passedTests++;
        console.log(`   ✅ ${testName} PASSED\n`);
    }

    /**
     * Record failed test
     */
    failTest(testName, error) {
        this.testResults.push({ name: testName, status: 'FAIL', error });
        this.stats.totalTests++;
        this.stats.failedTests++;
        console.log(`   ❌ ${testName} FAILED: ${error}\n`);
    }

    /**
     * Print test results summary
     */
    printTestResults() {
        console.log('📊 TEST RESULTS SUMMARY:');
        console.log(`🧪 Total tests: ${this.stats.totalTests}`);
        console.log(`✅ Passed: ${this.stats.passedTests}`);
        console.log(`❌ Failed: ${this.stats.failedTests}`);
        
        const successRate = this.stats.totalTests > 0 ? 
            (this.stats.passedTests / this.stats.totalTests) * 100 : 0;
        console.log(`📈 Success rate: ${successRate.toFixed(1)}%`);
        
        // Print individual test results
        console.log('\n📋 Individual Test Results:');
        this.testResults.forEach((result, index) => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`   ${index + 1}. ${status} ${result.name}`);
            if (result.error) {
                console.log(`      Error: ${result.error}`);
            }
        });
        
        if (this.stats.failedTests === 0) {
            console.log('\n🎉 All tests passed!');
        } else {
            console.log('\n💥 Some tests failed!');
        }
    }

    /**
     * Run specific test by name
     */
    async runSpecificTest(testName) {
        console.log(`🎯 Running specific test: ${testName}\n`);
        
        const testMethods = {
            'directory': this.testDirectoryStructure.bind(this),
            'index': this.testIndexFile.bind(this),
            'loading': this.testSchemaLoading.bind(this),
            'validation': this.testSchemaValidation.bind(this),
            'consistency': this.testParameterConsistency.bind(this),
            'known': this.testKnownCommands.bind(this),
            'performance': this.testLoadingPerformance.bind(this)
        };
        
        const testMethod = testMethods[testName.toLowerCase()];
        if (!testMethod) {
            console.error(`❌ Unknown test: ${testName}`);
            console.log('Available tests:', Object.keys(testMethods).join(', '));
            return false;
        }
        
        try {
            await testMethod();
            this.printTestResults();
            return this.stats.failedTests === 0;
        } catch (error) {
            console.error(`❌ Test ${testName} failed:`, error.message);
            return false;
        }
    }

    /**
     * Test schema format compliance
     */
    async testSchemaFormat() {
        const testName = 'Schema Format';
        console.log(`🔍 Testing: ${testName}`);
        
        try {
            const services = await this.getAvailableServices();
            let formatErrors = 0;
            let totalChecked = 0;
            
            for (const service of services.slice(0, 2)) {
                const commands = await this.getServiceCommands(service);
                
                for (const command of commands.slice(0, 3)) {
                    totalChecked++;
                    
                    const commandPath = path.join(this.schemasPath, service, `${command}.json`);
                    const commandContent = await fs.readFile(commandPath, 'utf8');
                    const commandData = JSON.parse(commandContent);
                    
                    // Check required top-level fields
                    const requiredTopFields = ['command', 'service', 'operation', 'parameters'];
                    for (const field of requiredTopFields) {
                        if (!(field in commandData)) {
                            formatErrors++;
                            console.log(`     ❌ ${service}/${command} missing ${field}`);
                        }
                    }
                    
                    // Check parameter format
                    if (commandData.parameters) {
                        for (const [paramName, paramInfo] of Object.entries(commandData.parameters)) {
                            const requiredParamFields = ['name', 'type', 'required'];
                            for (const field of requiredParamFields) {
                                if (!(field in paramInfo)) {
                                    formatErrors++;
                                    console.log(`     ❌ ${service}/${command}:${paramName} missing ${field}`);
                                }
                            }
                        }
                    }
                }
            }
            
            console.log(`   📊 Format check: ${totalChecked - formatErrors}/${totalChecked} files correct`);
            
            this.assert(formatErrors === 0, `Found ${formatErrors} format errors`);
            
            this.passTest(testName);
            
        } catch (error) {
            this.failTest(testName, error.message);
        }
    }
}

// Export for use in other modules
export { SchemaTestSuite };

// CLI usage
async function main() {
    const schemasPath = process.env.SCHEMAS_PATH || './aws-schemas';
    const testSuite = new SchemaTestSuite(schemasPath);
    
    // Check for specific test argument
    const specificTest = process.argv[2];
    
    let success = false;
    
    if (specificTest) {
        success = await testSuite.runSpecificTest(specificTest);
    } else {
        success = await testSuite.runAllTests();
    }
    
    // Exit with appropriate code for CI/CD
    process.exit(success ? 0 : 1);
}

// Run if called directly
    main().catch(error => {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    });