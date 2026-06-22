import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
const name = process.argv[2]; 
 
if (!name) {
    console.error('❌ Usage: npm run make:service <ResourceName>');
    process.exit(1);
}
 
const pascalCase = (str) => str.charAt(0).toUpperCase() + str.slice(1);
const camelCase = (str) => str.charAt(0).toLowerCase() + str.slice(1);
const kebabCase = (str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
 
const resourceName = pascalCase(name); 
const folderName = kebabCase(name);   
const endpointName = kebabCase(name) + 's'; 
const variableName = camelCase(name); 
 
const targetDir = path.join(__dirname, '..', 'api', folderName);
const targetFile = path.join(targetDir, `${resourceName}Service.ts`);
 
const fileContent = `import BaseService from '../BaseService';
 
class ${resourceName}Service extends BaseService {
    private static instance: ${resourceName}Service;
 
    public static getInstance(): ${resourceName}Service {
        if (!${resourceName}Service.instance) {
            ${resourceName}Service.instance = new ${resourceName}Service();
        }
        return ${resourceName}Service.instance;
    }
 
    private resource = '/${endpointName}';
 
    async list(params: object = {}): Promise<any> {
        return await this.request(this.resource, 'GET', params);
    }
 
    async create(payload: object): Promise<any> {
        return await this.request(this.resource, 'POST', payload);
    }
 
    async show(uuid: string): Promise<any> {
        return await this.request(\`\${this.resource}/\${uuid}\`, 'GET');
    }
 
    async update(uuid: string, payload: object): Promise<any> {
        return await this.request(\`\${this.resource}/\${uuid}\`, 'PUT', payload);
    }
 
    async delete(uuid: string): Promise<any> {
        return await this.request(\`\${this.resource}/\${uuid}\`, 'DELETE');
    }
 
    async restore(uuid: string): Promise<any> {
        return await this.request(\`\${this.resource}/\${uuid}/restore\`, 'POST');
    }
}
 
export const ${variableName}Service = ${resourceName}Service.getInstance();
`;
 
if (!fs.existsSync(targetDir)){
    fs.mkdirSync(targetDir, { recursive: true });
}
 
if (fs.existsSync(targetFile)) {
    console.error(`❌ File already exists: ${targetFile}`);
} else {
    fs.writeFileSync(targetFile, fileContent);
    console.log(`✅ Created Service: api/${folderName}/${resourceName}Service.ts`);
}
Advertisement
