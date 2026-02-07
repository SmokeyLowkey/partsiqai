import neo4j, { Driver } from 'neo4j-driver';
import { credentialsManager } from '../credentials/credentials-manager';

export interface Neo4jSchemaData {
  manufacturers: string[];
  models: string[];
  namespaces: string[];
  technicalDomains: string[];
  categories: string[];
  nodeLabels: string[];
  relationshipTypes: string[];
}

export class Neo4jSchemaDiscovery {
  private driver: Driver | null = null;
  private database: string;

  private constructor(
    private uri: string,
    private username: string,
    private password: string,
    database?: string
  ) {
    this.database = database || 'neo4j';
  }

  static async fromOrganization(organizationId: string): Promise<Neo4jSchemaDiscovery | null> {
    const credentials = await credentialsManager.getCredentials<{
      uri: string;
      username: string;
      password: string;
      database?: string;
    }>(organizationId, 'NEO4J');

    if (!credentials) {
      return null;
    }

    return new Neo4jSchemaDiscovery(
      credentials.uri,
      credentials.username,
      credentials.password,
      credentials.database
    );
  }

  private async getDriver(): Promise<Driver> {
    if (!this.driver) {
      this.driver = neo4j.driver(this.uri, neo4j.auth.basic(this.username, this.password));
    }
    return this.driver;
  }

  async getManufacturers(): Promise<string[]> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH (m:Manufacturer) RETURN DISTINCT m.name AS name ORDER BY m.name'
      );
      return result.records
        .map(r => r.get('name'))
        .filter((name): name is string => Boolean(name));
    } finally {
      await session.close();
    }
  }

  async getModelsByManufacturer(manufacturer: string): Promise<string[]> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const result = await session.run(
        `MATCH (mfg:Manufacturer {name: $manufacturer})-[:MANUFACTURES]->(model:Model)
         RETURN DISTINCT model.name AS name ORDER BY model.name`,
        { manufacturer }
      );
      return result.records
        .map(r => r.get('name'))
        .filter((name): name is string => Boolean(name));
    } finally {
      await session.close();
    }
  }

  async getAllModels(): Promise<{ name: string; manufacturer: string }[]> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const result = await session.run(
        `MATCH (mfg:Manufacturer)-[:MANUFACTURES]->(model:Model)
         RETURN DISTINCT model.name AS name, mfg.name AS manufacturer
         ORDER BY mfg.name, model.name`
      );
      return result.records
        .map(r => ({
          name: r.get('name'),
          manufacturer: r.get('manufacturer'),
        }))
        .filter(m => m.name && m.manufacturer);
    } finally {
      await session.close();
    }
  }

  async getNamespaces(): Promise<string[]> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const result = await session.run(
        `MATCH (p:Part) WHERE p.namespace IS NOT NULL
         RETURN DISTINCT p.namespace AS namespace ORDER BY namespace
         LIMIT 100`
      );
      return result.records
        .map(r => r.get('namespace'))
        .filter((ns): ns is string => Boolean(ns));
    } finally {
      await session.close();
    }
  }

  async getTechnicalDomains(): Promise<string[]> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH (d:TechnicalDomain) RETURN DISTINCT d.name AS name ORDER BY d.name'
      );
      return result.records
        .map(r => r.get('name'))
        .filter((name): name is string => Boolean(name));
    } finally {
      await session.close();
    }
  }

  async getCategories(): Promise<string[]> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH (c:Category) RETURN DISTINCT c.name AS name ORDER BY c.name'
      );
      return result.records
        .map(r => r.get('name'))
        .filter((name): name is string => Boolean(name));
    } finally {
      await session.close();
    }
  }

  async getModelDetails(manufacturer: string, model: string): Promise<{
    namespaces: string[];
    technicalDomains: string[];
    categories: string[];
    serialRanges: string[];
  }> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const [nsResult, domainResult, catResult, srResult] = await Promise.all([
        session.run(
          `MATCH (mfg:Manufacturer {name: $manufacturer})-[:MANUFACTURES]->(m:Model {name: $model})
           MATCH (d:TechnicalDomain)-[:HAS_DOMAIN]->(m)
           MATCH (p:Part)-[:CONTAINS_PART]-(d)
           WHERE p.namespace IS NOT NULL
           RETURN DISTINCT p.namespace AS namespace ORDER BY namespace`,
          { manufacturer, model }
        ),
        session.run(
          `MATCH (m:Model {name: $model})
           MATCH (d:TechnicalDomain)-[:HAS_DOMAIN]->(m)
           RETURN DISTINCT d.name AS name ORDER BY d.name`,
          { model }
        ),
        session.run(
          `MATCH (mfg:Manufacturer {name: $manufacturer})-[:MANUFACTURES]->(m:Model {name: $model})
           MATCH (d:TechnicalDomain)-[:HAS_DOMAIN]->(m)
           MATCH (p:Part)-[:CONTAINS_PART]-(d)
           MATCH (p)-[:BELONGS_TO_CATEGORY]->(c:Category)
           RETURN DISTINCT c.name AS name ORDER BY c.name`,
          { manufacturer, model }
        ),
        session.run(
          `MATCH (mfg:Manufacturer {name: $manufacturer})-[:MANUFACTURES]->(m:Model {name: $model})
           MATCH (d:TechnicalDomain)-[:HAS_DOMAIN]->(m)
           MATCH (p:Part)-[:CONTAINS_PART]-(d)
           MATCH (p)-[:VALID_FOR_RANGE]->(s:SerialNumberRange)
           RETURN DISTINCT s.range AS range ORDER BY s.range`,
          { manufacturer, model }
        ),
      ]);

      return {
        namespaces: nsResult.records.map(r => r.get('namespace')).filter(Boolean),
        technicalDomains: domainResult.records.map(r => r.get('name')).filter(Boolean),
        categories: catResult.records.map(r => r.get('name')).filter(Boolean),
        serialRanges: srResult.records.map(r => r.get('range')).filter(Boolean),
      };
    } finally {
      await session.close();
    }
  }

  async getNodeLabels(): Promise<string[]> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const result = await session.run('CALL db.labels() YIELD label RETURN label ORDER BY label');
      return result.records.map(r => r.get('label'));
    } finally {
      await session.close();
    }
  }

  async getRelationshipTypes(): Promise<string[]> {
    const driver = await this.getDriver();
    const session = driver.session({ database: this.database });
    try {
      const result = await session.run(
        'CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType'
      );
      return result.records.map(r => r.get('relationshipType'));
    } finally {
      await session.close();
    }
  }

  async getFullSchema(): Promise<Neo4jSchemaData> {
    const [
      manufacturers,
      namespaces,
      technicalDomains,
      categories,
      nodeLabels,
      relationshipTypes,
    ] = await Promise.all([
      this.getManufacturers(),
      this.getNamespaces(),
      this.getTechnicalDomains(),
      this.getCategories(),
      this.getNodeLabels(),
      this.getRelationshipTypes(),
    ]);

    return {
      manufacturers,
      models: [], // Loaded on-demand when manufacturer is selected
      namespaces,
      technicalDomains,
      categories,
      nodeLabels,
      relationshipTypes,
    };
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}
