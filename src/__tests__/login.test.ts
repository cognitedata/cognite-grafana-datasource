/* eslint-disable */
import { getMockedDataSource } from './utils';

const { ds, backendSrvMock } = getMockedDataSource();

function makeLoginResponse(loggedIn: boolean, project: string) {
  return Promise.resolve({
    data: {
      data: { loggedIn, project },
    },
    status: 200,
  });
}

describe('Login', () => {
  describe('When given valid login info and correct project', () => {
    const response = makeLoginResponse(true, 'TestProject');

    it('should log the user in', async () => {
      backendSrvMock.datasourceRequest = jest.fn().mockReturnValue(response);
      const result = await ds.testDatasource();

      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      expect(result).toMatchSnapshot();
    });
  });

  describe('When given valid login info but incorrect project', () => {
    const response = makeLoginResponse(true, 'WrongProject');

    it('should display an error message', async () => {
      backendSrvMock.datasourceRequest = jest.fn().mockReturnValue(response);
      const result = await ds.testDatasource();

      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      expect(result).toMatchSnapshot();
    });
  });

  describe('When given invalid login info', () => {
    const response = makeLoginResponse(false, 'string');

    it('should display an error message', async () => {
      backendSrvMock.datasourceRequest = jest.fn().mockReturnValue(response);
      const result = await ds.testDatasource();

      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      expect(result).toMatchSnapshot();
    });
  });
});
