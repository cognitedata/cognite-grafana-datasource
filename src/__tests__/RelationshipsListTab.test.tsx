import React from 'react';
import 'react-dom';
import Enzyme, { shallow, mount } from 'enzyme';
import toJson from 'enzyme-to-json';
import Adapter from 'enzyme-adapter-react-16';
import { RelationshipsListTab } from '../components/RelationshipsListTab';
import { defaultQuery, CogniteQuery } from '../types';
import { getMockedDataSource } from './utils';

Enzyme.configure({ adapter: new Adapter() });

const defaultCogniteQuery = defaultQuery as CogniteQuery;
const ds = getMockedDataSource();
const elem = (
  <RelationshipsListTab
    query={defaultCogniteQuery}
    datasource={ds}
    onQueryChange={() => jest.fn()}
  />
);
let wrapper = shallow(elem);
describe('RelationshipsListTab', () => {
  it('equals with snapshot', () => {
    expect(toJson(wrapper)).toMatchSnapshot();
  });
  it('renders under mount', () => {});
  // TODO integrate a full react component unit and feature test
  wrapper = mount(elem);
});
