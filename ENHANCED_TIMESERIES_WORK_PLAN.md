# Enhanced Timeseries Data Model Support for Grafana - Work Plan

## Overview
This work plan implements enhanced timeseries data model support for the Cognite Grafana datasource, focusing on DMS-based CogniteTimeSeries search, unit conversion, status code aggregates, and asset/equipment-based timeseries selection.

## Implementation Status
- **Current Branch**: `feature/cognite-timeseries-search-tab`
- **Base Implementation**: CogniteTimeSeries search tab with DMS integration already implemented in PR #557
- **Key Features Already Done**: Real-time search, space/view selection, instanceId support

## Work Plan Structure

### Epic 1: Enhanced CogniteTimeSeries Direct Selection (P0)
**Goal**: Enhance the existing CogniteTimeSeries search functionality with advanced features

#### Task 1.1: Implement Unit Conversion Support
- **Description**: Add comprehensive unit conversion functionality to the CogniteTimeSeries search tab, allowing users to convert between different units (e.g., Celsius to Fahrenheit, meters to feet, bar to psi). This feature will integrate with the CogniteUnit type from the core data model to provide standardized unit conversions. Users should be able to select source and target units from a dropdown, with the conversion applied in real-time to the timeseries data visualization. The implementation should handle both linear and non-linear unit conversions, maintain precision, and display conversion metadata in the query result. Units will be accessed through the CogniteUnit core concept which includes symbol, quantity, source, and sourceReference properties.
- **Cognite APIs**: 
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances` for retrieving CogniteUnit instances from the core data model
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/search` for searching available CogniteUnit instances
  - [Time Series API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/timeseries/data` for retrieving timeseries data with unit references
- **Files to Review**: 
  - `src/components/cogniteTimeSeriesSearchTab.tsx` - Main UI component for unit selection
  - `src/types.ts` - Type definitions for unit conversion interfaces
  - `src/cdf/client.ts` - API client methods for units catalog
  - `src/utils.ts` - Utility functions for unit conversion calculations

#### Task 1.2: Add Status Code Aggregates
- **Description**: Implement comprehensive status code aggregation options for CogniteTimeSeries queries, enabling users to aggregate data based on status codes (good, bad, uncertain). This feature will provide aggregation methods such as count, percentage, duration, and weighted averages based on status quality. Users should be able to configure status code filtering (include/exclude certain status codes), choose aggregation methods, and visualize status code distributions over time. The implementation should handle both historical and real-time status code analysis, with proper handling of null values and status code transitions.
- **Cognite APIs**:
  - [Time Series API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/timeseries/data` for retrieving data with status codes
  - [Time Series API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/timeseries/data/aggregate` for status-based aggregations
- **Files to Review**:
  - `src/components/cogniteTimeSeriesSearchTab.tsx` - UI for status code aggregation options
  - `src/datasources/TimeseriesDatasource.ts` - Core logic for status code processingex
  - `src/types.ts` - Type definitions for status code aggregation interfaces
  - `src/cdf/client.ts` - API client methods for aggregated queries

#### Task 1.3: Implement Label Templating
- **Description**: Add advanced label templating functionality to customize how timeseries are displayed in graphs using metadata from CogniteTimeSeries instances. This feature will allow users to create custom label templates using CogniteTimeSeries metadata fields (name, description, unit references, asset references, custom metadata from the data model). Templates should support variable substitution, conditional formatting, and dynamic label generation based on query context. Users should be able to define label templates at the query level, save template presets, and preview labels before applying them. The implementation should handle missing metadata gracefully and provide sensible fallback labeling.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances` for retrieving CogniteTimeSeries instances with metadata
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/search` for searching CogniteTimeSeries instances with specific metadata
- **Files to Review**:
  - `src/components/cogniteTimeSeriesSearchTab.tsx` - UI for label template configuration
  - `src/datasources/TimeseriesDatasource.ts` - Logic for applying label templates
  - `src/types.ts` - Type definitions for label template interfaces
  - `src/utils.ts` - Template parsing and rendering utilities

#### Task 1.4: Backend Query Migration
- **Description**: Migrate timeseries queries from frontend to backend for Grafana Alerting compatibility and improved performance. This involves implementing server-side query processing in the Go backend to support Grafana's alerting engine, which requires backend query execution. The migration should maintain full feature parity with frontend queries while adding support for Grafana's query caching, alerting, and scheduled queries. The implementation should handle query transformation, result caching, error handling, and provide proper query logging for debugging. Authentication will reuse the existing pattern through Grafana's data proxy without requiring new authentication configuration.
- **Cognite APIs**:
  - [Time Series API](https://api-docs.cognite.com/) - All timeseries endpoints for server-side integration
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/search` for DMS queries
  - Authentication handled through existing Grafana data proxy pattern
- **Files to Review**:
  - `pkg/plugin/datasource.go` - Main backend query processing logic
  - `src/datasources/TimeseriesDatasource.ts` - Frontend query interface
  - `src/datasource.ts` - Query routing and backend integration
  - `pkg/plugin/datasource_test.go` - Backend query testing

#### Task 1.5: Enhanced Search Filtering
- **Description**: Add comprehensive advanced filtering options for CogniteTimeSeries search including metadata-based filters, hierarchical filtering, and saved filter presets. This feature will enable users to filter timeseries based on custom metadata fields, asset relationships, data quality metrics, and time-based criteria. Users should be able to create complex filter expressions using logical operators (AND, OR, NOT), save frequently used filters as presets, and apply filters across multiple data model spaces. The implementation should provide real-time search suggestions, filter result previews, and filter performance optimization.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/search` for advanced search capabilities
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/aggregate` for filter result statistics
  - [Time Series API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/timeseries/search` for traditional timeseries search
- **Files to Review**:
  - `src/components/cogniteTimeSeriesSearchTab.tsx` - Advanced search UI components
  - `src/cdf/client.ts` - Search API integration and query building
  - `src/types.ts` - Search filter type definitions
  - `src/utils.ts` - Search query optimization utilities

### Epic 2: Configuration & Legacy Mode Toggle (P0)
**Goal**: Implement configuration system to control feature visibility and legacy mode

#### Task 2.1: Add Legacy Mode Configuration
- **Description**: Implement a comprehensive configuration system to control the legacy mode toggle, defaulting to false for new installations while providing smooth migration path for existing users. This configuration should be stored in the datasource settings and persist across sessions. The configuration interface should provide clear explanations of what legacy mode entails, what features will be deprecated, and guidance on migration. The implementation should include configuration validation, default value handling, and proper error messaging for invalid configurations.
- **Cognite APIs**:
  - Authentication handled through existing Grafana data proxy pattern
  - [Projects API](https://api-docs.cognite.com/) - For retrieving project capabilities and feature availability
- **Files to Review**:
  - `src/components/configEditor.tsx` - Configuration UI with legacy mode toggle
  - `src/types.ts` - Configuration type definitions and validation schemas
  - `src/plugin.json` - Plugin configuration schema updates
  - `src/datasource.ts` - Configuration persistence and retrieval logic

#### Task 2.2: Implement Feature Toggle Logic
- **Description**: Develop comprehensive feature toggle logic to selectively show/hide features based on legacy mode configuration throughout the application. This system should dynamically control the visibility of UI components, available query types, and feature capabilities based on the configuration state. The implementation should provide consistent behavior across all components, handle edge cases gracefully, and maintain backward compatibility. Feature toggles should be implemented at the component level with proper prop drilling and context management.
- **Cognite APIs**:
  - [Projects API](https://api-docs.cognite.com/) - For checking project feature availability
  - Authentication and permissions handled through existing Grafana data proxy pattern
- **Files to Review**:
  - `src/components/queryEditor.tsx` - Main query editor with conditional feature rendering
  - `src/datasource.ts` - Core datasource logic with feature toggles
  - `src/types.ts` - Feature toggle type definitions
  - `src/utils.ts` - Feature toggle utility functions

#### Task 2.3: Migration Warning System
- **Description**: Create a comprehensive warning and guidance system to help users transition from legacy mode to the new data modeling approach. This system should provide contextual warnings when legacy features are being used, migration recommendations, and step-by-step guidance for transitioning existing queries and dashboards. The implementation should include dismissible warnings, migration progress tracking, and links to documentation and support resources.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - For checking data model availability and compatibility
  - [Time Series API](https://api-docs.cognite.com/) - For validating existing timeseries configurations
- **Files to Review**:
  - `src/components/queryEditor.tsx` - Warning display and migration guidance
  - `src/components/configEditor.tsx` - Configuration migration tools
  - `src/types.ts` - Warning message and migration state types
  - `src/utils.ts` - Migration validation and recommendation logic

#### Task 2.4: Backward Compatibility Handling
- **Description**: Ensure comprehensive backward compatibility for existing dashboards and queries when legacy mode is enabled, including proper query translation, data format preservation, and feature parity maintenance. This involves implementing compatibility layers that translate between old and new query formats, maintain API response formats, and ensure that existing visualizations continue to function correctly. The implementation should handle version migration, query format translation, and provide fallback mechanisms for deprecated features.
- **Cognite APIs**:
  - [Time Series API](https://api-docs.cognite.com/) - For maintaining legacy timeseries query compatibility
  - [Assets API](https://api-docs.cognite.com/) - For legacy asset-based queries
  - [Relationships API](https://api-docs.cognite.com/) - For legacy relationship queries
- **Files to Review**:
  - `src/datasource.ts` - Backward compatibility layer implementation
  - `src/datasources/TimeseriesDatasource.ts` - Legacy query format support
  - `src/types.ts` - Compatibility type definitions
  - `src/utils.ts` - Query translation and compatibility utilities

### Epic 3: Legacy Feature Deprecation (P1)
**Goal**: Deprecate legacy features when legacy mode is disabled

#### Task 3.1: Deprecate Templates Tab
- **Description**: Implement deprecation of the templates tab functionality when legacy mode is disabled, including comprehensive deprecation notices, migration guidance, and alternative solution recommendations. This involves hiding the templates tab from the UI, displaying informative deprecation messages when users attempt to access template functionality, and providing clear migration paths to the new data modeling approach. The implementation should handle existing template configurations gracefully and provide export/import functionality for template migration.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - For migrating template functionality to data models
  - [Time Series API](https://api-docs.cognite.com/) - For template-based timeseries queries
- **Files to Review**:
  - `src/components/templatesTab.tsx` - Template tab deprecation logic
  - `src/components/queryEditor.tsx` - Tab visibility control
  - `src/types.ts` - Template deprecation state types
  - `src/utils.ts` - Template migration utilities

#### Task 3.2: Deprecate Extraction Pipelines Tab
- **Description**: Implement comprehensive deprecation of the extraction pipelines tab when legacy mode is disabled, including proper deprecation messaging, alternative workflow recommendations, and migration guidance to modern data ingestion approaches. This involves hiding the extraction pipelines interface, providing clear communication about deprecation reasons, and offering alternative solutions using modern Cognite capabilities. The implementation should handle existing pipeline configurations and provide export functionality for pipeline documentation.
- **Cognite APIs**:
  - [Data Workflows API](https://api-docs.cognite.com/) - For modern workflow alternatives
  - [Extraction Pipelines API](https://api-docs.cognite.com/) - For legacy pipeline information
- **Files to Review**:
  - `src/components/extractionPipelinesTab.tsx` - Pipeline tab deprecation logic
  - `src/components/queryEditor.tsx` - Tab visibility and deprecation messages
  - `src/types.ts` - Pipeline deprecation type definitions
  - `src/utils.ts` - Pipeline migration and export utilities

#### Task 3.3: Deprecate Legacy Data Models
- **Description**: Implement comprehensive deprecation of legacy data model options when legacy mode is disabled, including removal of outdated data model interfaces, migration guidance to modern DMS-based approaches, and proper communication about the transition. This involves hiding legacy data model selection options, providing clear migration paths to the new flexible data modeling capabilities, and ensuring that existing queries using legacy data models continue to function with appropriate warnings and migration suggestions.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - For modern data model capabilities
  - [Assets API](https://api-docs.cognite.com/) - For legacy asset model deprecation
- **Files to Review**:
  - `src/components/queryEditor.tsx` - Legacy data model option removal
  - `src/datasources/index.ts` - Data source deprecation logic
  - `src/types.ts` - Legacy data model type definitions
  - `src/utils.ts` - Data model migration utilities

### Epic 4: GraphQL Querying & Data Model Integration (P0)
**Goal**: Implement GraphQL-based querying for flexible data model integration

#### Task 4.1: Implement Raw GraphQL Query Support
- **Description**: Develop comprehensive support for raw GraphQL queries in the query editor, enabling users to write and execute custom GraphQL queries directly against the Cognite Data Modeling API. This feature should provide a code editor with syntax highlighting, query validation, auto-completion, and error handling. Users should be able to save and reuse query templates, access query history, and receive real-time feedback on query syntax and execution. The implementation should handle authentication, query optimization, and result formatting for Grafana visualization.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/query` for GraphQL query execution
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/search` for query building assistance
- **Files to Review**:
  - `src/components/flexibleDataModellingTab.tsx` - GraphQL query editor interface
  - `src/datasources/FlexibleDataModellingDatasource.ts` - GraphQL query execution logic
  - `src/types.ts` - GraphQL query type definitions
  - `src/utils.ts` - GraphQL query validation and formatting utilities

#### Task 4.2: Add Query Builder Interface
- **Description**: Create an intuitive visual query builder interface for common GraphQL query patterns, enabling users to construct complex queries without writing GraphQL syntax manually. This interface should provide drag-and-drop functionality, visual relationship mapping, filter builders, and aggregation options. Users should be able to preview generated GraphQL queries, switch between visual and code modes, and save query patterns as reusable templates. The implementation should handle query complexity validation, performance optimization suggestions, and provide guided query construction for common use cases.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances` for data model structure
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/views` for view definitions
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/spaces` for space information
- **Files to Review**:
  - `src/components/flexibleDataModellingTab.tsx` - Visual query builder components
  - `src/components/queryEditor.tsx` - Query builder integration
  - `src/types.ts` - Query builder type definitions
  - `src/utils.ts` - Query generation and optimization utilities

#### Task 4.3: Implement Timeseries-focused GraphQL Queries
- **Description**: Develop specialized GraphQL query types optimized for timeseries data retrieval, including time-based aggregations, multi-series queries, and temporal relationship analysis. This feature should provide pre-built query templates for common timeseries patterns, optimized query execution for time-based data, and specialized result formatting for time-series visualization. Users should be able to query timeseries data using temporal filters, aggregate across multiple time ranges, and combine timeseries data with related asset and event information.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/query` for timeseries-specific queries
  - [Time Series API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/timeseries/data` for data retrieval optimization
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/aggregate` for temporal aggregations
- **Files to Review**:
  - `src/datasources/FlexibleDataModellingDatasource.ts` - Timeseries query optimization
  - `src/cdf/client.ts` - Timeseries-specific API integration
  - `src/types.ts` - Timeseries query type definitions
  - `src/utils.ts` - Temporal query utilities and optimizations

#### Task 4.4: Dashboard Variables Integration
- **Description**: Enable comprehensive integration of dashboard variables with GraphQL queries, allowing users to create dynamic queries that respond to dashboard filters and variable selections. This feature should support variable substitution in GraphQL queries, dynamic query generation based on variable values, and proper handling of multi-value variables. Users should be able to reference dashboard variables in query filters, use variables for dynamic field selection, and create cascading variable dependencies. The implementation should handle variable validation, provide variable preview functionality, and ensure proper query caching with variable dependencies.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - All endpoints for variable-based dynamic queries
  - [Assets API](https://api-docs.cognite.com/) - For asset-based variable queries
  - [Time Series API](https://api-docs.cognite.com/) - For timeseries variable integration
- **Files to Review**:
  - `src/components/flexibleDataModellingTab.tsx` - Variable integration UI
  - `src/components/variableQueryEditor.tsx` - Variable query configuration
  - `src/types.ts` - Variable integration type definitions
  - `src/utils.ts` - Variable substitution and validation utilities

### Epic 5: Timeseries from Asset/Equipment Reference (P0)
**Goal**: Enable timeseries selection through asset/equipment references

#### Task 5.1: Asset/Equipment Browser Component
- **Description**: Create a comprehensive browser component for navigating and selecting assets/equipment from the data model, providing an intuitive interface for exploring asset hierarchies and selecting relevant equipment for timeseries analysis. This component should support hierarchical navigation, search functionality, filtering by asset types, and multi-selection capabilities. Users should be able to browse asset trees, search for specific equipment, filter by metadata attributes, and preview associated timeseries before selection. The implementation should handle large asset hierarchies efficiently, provide lazy loading for performance, and support both single and multi-selection modes.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/search` for asset/equipment search
  - [Assets API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/assets` for legacy asset browsing
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances` for asset metadata
- **Files to Review**:
  - `src/components/` - New asset browser component files
  - `src/components/queryEditor.tsx` - Asset browser integration
  - `src/types.ts` - Asset browser type definitions
  - `src/utils.ts` - Asset navigation and search utilities

#### Task 5.2: Implement Asset-based Timeseries Lookup
- **Description**: Develop comprehensive functionality to find and retrieve timeseries data associated with selected assets/equipment through data model relationships. This feature should automatically discover timeseries connected to assets through various relationship types, handle multiple timeseries per asset, and provide timeseries metadata and quality information. Users should be able to view available timeseries for selected assets, filter timeseries by type or metadata, and understand the relationship context between assets and timeseries. The implementation should handle complex relationship chains, provide efficient lookup algorithms, and support both direct and indirect timeseries associations.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/search` for relationship-based timeseries lookup
  - [Relationships API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/relationships` for asset-timeseries relationships
  - [Time Series API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/timeseries` for timeseries metadata
- **Files to Review**:
  - `src/datasources/TimeseriesDatasource.ts` - Asset-based timeseries lookup logic
  - `src/cdf/client.ts` - Relationship traversal and timeseries discovery
  - `src/types.ts` - Asset-timeseries relationship type definitions
  - `src/utils.ts` - Relationship resolution and caching utilities

#### Task 5.3: Multi-asset Selection Support
- **Description**: Implement comprehensive support for selecting multiple assets/equipment simultaneously for batch timeseries retrieval and analysis. This feature should handle bulk operations efficiently, provide progress indicators for large selections, and support various selection modes (individual, range, search-based). Users should be able to select multiple assets across different hierarchy levels, apply bulk operations to selected assets, and manage large selection sets with proper performance optimization. The implementation should handle memory management for large selections, provide selection persistence across sessions, and support export/import of asset selection lists.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - Bulk query operations for multiple assets
  - [Time Series API](https://api-docs.cognite.com/) - Batch timeseries data retrieval
  - [Assets API](https://api-docs.cognite.com/) - Bulk asset metadata operations
- **Files to Review**:
  - `src/components/queryEditor.tsx` - Multi-selection UI and management
  - `src/types.ts` - Multi-selection type definitions and state management
  - `src/utils.ts` - Bulk operation utilities and optimization
  - `src/cdf/client.ts` - Batch API call optimization

#### Task 5.4: Asset Hierarchy Navigation
- **Description**: Implement intuitive navigation through complex asset hierarchies for easier asset selection and understanding of asset relationships. This feature should provide tree-view navigation, breadcrumb trails, search within hierarchy levels, and contextual information about asset relationships. Users should be able to expand/collapse hierarchy levels, navigate using keyboard shortcuts, understand parent-child relationships, and access asset metadata inline. The implementation should handle deep hierarchies efficiently, provide hierarchy caching for performance, and support both top-down and bottom-up navigation patterns.
- **Cognite APIs**:
  - [Data Modeling API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/models/instances/search` for hierarchy traversal
  - [Assets API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/assets` for legacy asset hierarchy
  - [Relationships API](https://api-docs.cognite.com/) - `/api/v1/projects/{project}/relationships` for asset relationship mapping
- **Files to Review**:
  - `src/components/resourceSelect.tsx` - Enhanced resource selection with hierarchy
  - `src/cdf/client.ts` - Hierarchy navigation API integration
  - `src/types.ts` - Hierarchy navigation type definitions
  - `src/utils.ts` - Hierarchy traversal and caching utilities

### Epic 6: Backend Migration & Evaluation (P0)
**Goal**: Evaluate and implement backend query processing for Grafana compatibility

#### Task 6.1: Grafana Feature Compatibility Analysis
- **Description**: Conduct comprehensive analysis of Grafana features that require backend query processing, including alerting, scheduled queries, query caching, and enterprise features. This analysis should identify which current frontend-only features need backend implementation, evaluate performance implications, and document compatibility requirements. The analysis should cover Grafana alerting engine requirements, query caching mechanisms, scheduled query execution, and enterprise security features. Results should include detailed compatibility matrix, migration recommendations, and implementation priorities. Authentication analysis should confirm that existing Grafana data proxy pattern can be reused without new configuration requirements.
- **Cognite APIs**:
  - All relevant Cognite APIs - for backend integration analysis
  - Authentication handled through existing Grafana data proxy pattern
  - [Time Series API](https://api-docs.cognite.com/) - for backend query optimization
- **Files to Review**:
  - `pkg/plugin/datasource.go` - Current backend implementation analysis
  - `src/datasource.ts` - Frontend-backend interaction patterns
  - `src/types.ts` - Query type definitions for backend compatibility
  - Documentation files for compatibility requirements

#### Task 6.2: Backend Query Implementation
- **Description**: Implement comprehensive backend query processing for features that require server-side execution, including Grafana alerting support, query caching, and performance optimization. This implementation should provide full feature parity with frontend queries while adding backend-specific capabilities like query optimization, caching, and alerting support. The backend should handle query parsing, result formatting, error handling, and proper logging. Implementation should include query translation between frontend and backend formats, efficient data processing, and proper resource management. Authentication will be handled through Grafana's data proxy using the existing authentication pattern.
- **Cognite APIs**:
  - [Time Series API](https://api-docs.cognite.com/) - Primary backend integration
  - [Data Modeling API](https://api-docs.cognite.com/) - Backend DMS query support
  - Authentication handled through existing Grafana data proxy pattern
  - [Assets API](https://api-docs.cognite.com/) - Backend asset query support
- **Files to Review**:
  - `pkg/plugin/datasource.go` - Main backend query implementation
  - `pkg/plugin/datasource_test.go` - Backend query testing and validation
  - `src/datasource.ts` - Frontend-backend query coordination
  - `src/types.ts` - Backend query type definitions

### Epic 7: Documentation and Training (P0)
**Goal**: Provide comprehensive documentation and training materials

#### Task 7.1: User Documentation
- **Description**: Create comprehensive user documentation covering all new features, migration procedures, and best practices for the enhanced timeseries data model support. This documentation should include step-by-step guides for feature usage, migration from legacy mode, troubleshooting guides, and best practice recommendations. Content should cover CogniteTimeSeries search, unit conversion, status code aggregates, GraphQL querying, asset-based timeseries selection, and configuration management. Documentation should be accessible to users with varying technical backgrounds and include screenshots, examples, and interactive tutorials.
- **Cognite APIs**:
  - Reference documentation should cover all APIs used in the implementation
  - [Data Modeling API](https://api-docs.cognite.com/) - for data modeling documentation
  - [Time Series API](https://api-docs.cognite.com/) - for timeseries feature documentation
- **Files to Review**:
  - `README.md` - Main documentation updates
  - `DEVELOPMENT.md` - Development documentation updates
  - New documentation files for feature-specific guides
  - `provisioning/README.md` - Provisioning and setup documentation

#### Task 7.2: API Documentation
- **Description**: Create detailed API documentation for all new endpoints, data structures, and integration patterns introduced in the enhanced timeseries support. This documentation should include comprehensive API reference, data model schemas, authentication requirements, and integration examples. Content should cover backend API endpoints, GraphQL schema definitions, configuration options, and data transformation formats. Documentation should include code examples, request/response samples, and integration patterns for different use cases.
- **Cognite APIs**:
  - Documentation should reference all used Cognite APIs with proper integration examples
  - [Data Modeling API](https://api-docs.cognite.com/) - for DMS integration documentation
  - [Time Series API](https://api-docs.cognite.com/) - for timeseries API documentation
- **Files to Review**:
  - `src/types.ts` - Type definitions documentation
  - `src/cdf/types.ts` - CDF-specific type documentation
  - `pkg/plugin/datasource.go` - Backend API documentation
  - New API documentation files

#### Task 7.3: Training Materials
- **Description**: Develop comprehensive training materials and examples for users transitioning from legacy mode to the new data modeling approach. This should include interactive tutorials, example dashboards, video guides, and hands-on exercises. Training materials should cover common migration scenarios, feature comparison guides, and practical examples of using new capabilities. Content should be structured for different user roles (end users, administrators, developers) and include progressive learning paths from basic to advanced usage.
- **Cognite APIs**:
  - Training examples should demonstrate real-world usage of all implemented APIs
  - [Data Modeling API](https://api-docs.cognite.com/) - for data modeling training examples
  - [Time Series API](https://api-docs.cognite.com/) - for timeseries training examples
- **Files to Review**:
  - `provisioning/dashboards/` - Example dashboard creation and updates
  - `README.md` - Training resource links and getting started guides
  - New training material files and directories
  - Example configuration files for different use cases

## Implementation Priority
1. **P0 Tasks**: Must be completed for initial release
2. **P1 Tasks**: Should be completed for full feature parity

## Testing Strategy
- Unit tests for all new components and functions
- Integration tests for DMS and GraphQL functionality
- End-to-end tests for user workflows
- Backward compatibility tests for legacy mode
- Performance benchmarks for backend query processing
- API integration tests for all Cognite API endpoints

## Acceptance Criteria
- All P0 features implemented and tested
- Legacy mode toggle working correctly with proper deprecation handling
- Backward compatibility maintained for existing dashboards
- Documentation complete and comprehensive
- Performance benchmarks met for backend query processing
- Full integration with Cognite APIs as documented
- User training materials validated with target users 