import React from 'react';
import { INSTANCE_REF_HINT } from '../../cdf/instanceRef';
import { GraphqlExample } from './GraphqlExamplesModal';

/** How variables interpolate, which reads the same in a panel and a variable query. */
const VARIABLES_LEAD = (
  <>
    Dashboard variables are interpolated before the query runs, with either{' '}
    <code>$variable</code> or <code>{'${variable}'}</code> syntax. A variable whose value
    field is <strong>Instance ID</strong> holds a whole reference: <code>$asset</code> is written
    as a GraphQL instance argument (a list for a multi-value variable), and{' '}
    <code>{'${asset.space}'}</code> / <code>{'${asset.externalId}'}</code> give one part of it.
  </>
);

export const PANEL_GRAPHQL_EXAMPLES: GraphqlExample[] = [
  {
    title: 'Time series on a data modelling instance',
    lead: (
      <>
        Select <code>space</code> and <code>externalId</code> on the time series and every row
        is plotted, using <code>name</code> as its label. Selecting <code>type</code> too skips
        the rows that are not <code>numeric</code>.
      </>
    ),
    code: `query MyQuery {
  listCogniteTimeSeries {
    items {
      space
      externalId
      name
      type
    }
  }
}`,
  },
  {
    title: 'Time series reached through a relation',
    lead: (
      <>
        The same fields work one level down, so a query can start from an activity or a piece
        of equipment and plot the time series hanging off it. A relation to many instances is
        a connection, so its rows sit under <code>items</code>.
      </>
    ),
    code: `query MyQuery {
  listCogniteActivity(first: 10) {
    items {
      name
      timeSeries {
        items {
          space
          externalId
          name
          type
        }
      }
    }
  }
}`,
  },
  {
    title: 'Using dashboard variables',
    lead: VARIABLES_LEAD,
    code: `query MyQuery {
  listCogniteTimeSeries(filter: { space: { eq: "\${space}" } }) {
    items {
      space
      externalId
      name
      type
    }
  }
}`,
  },
  {
    title: 'Time series of an asset held in a variable',
    lead: (
      <>
        Filtering on the direct relation to the asset a variable holds. A multi-value
        variable becomes a list, which <code>containsAny</code> accepts as it is.
      </>
    ),
    code: `query MyQuery {
  listCogniteTimeSeries(
    filter: {
      assets: {
        containsAny: $asset
      }
    }
  ) {
    items {
      space
      externalId
      name
      description
    }
  }
}`,
  },
];

export const VARIABLE_GRAPHQL_EXAMPLES: GraphqlExample[] = [
  {
    title: 'Basic query',
    lead: 'Every field selected inside the result envelope becomes selectable in the Value dropdown.',
    code: `query MyQuery {
  listCogniteAsset {
    items {
      name
      externalId
    }
  }
}`,
  },
  {
    title: 'Using other variables',
    lead: VARIABLES_LEAD,
    code: `query MyQuery {
  listCogniteAsset(filter: { externalId: { eq: "\${assetId}" } }) {
    items {
      name
      externalId
    }
  }
}`,
  },
  {
    title: 'Children of an asset held in a variable',
    lead: (
      <>
        A variable holding an instance reference can be passed straight to an{' '}
        <code>instance</code> argument.
      </>
    ),
    code: `query ChildrenOfAsset {
  getCogniteAssetById(instance: \${asset}) {
    items {
      children {
        space
        externalId
        name
      }
    }
  }
}`,
  },
  {
    title: 'Emitting instance references',
    lead: (
      <>
        Select both <code>space</code> and <code>externalId</code> to unlock the{' '}
        <strong>Instance ID</strong> value field. Each value is emitted as{' '}
        <code>{INSTANCE_REF_HINT}</code> so a query can filter on a direct
        relation, while the picker still shows the readable name.
      </>
    ),
    code: `query MyQuery {
  listCogniteAsset {
    items {
      space
      externalId
      name
    }
  }
}`,
  },
];
