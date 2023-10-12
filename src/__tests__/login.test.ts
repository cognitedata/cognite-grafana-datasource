import { getMockedDataSource } from '../test_utils';

jest.mock('@grafana/runtime');
type Mock = jest.Mock;

describe('Login with OAuth2', () => {
  const ds = getMockedDataSource({ oauthPassThru: true });
  const { backendSrv } = ds;

  function makeLoginResponse(loggedIn: boolean, project: string) {
    return Promise.resolve({
      data: {
        projects: [{ projectUrlName: project }],
      },
      status: 200,
    });
  }

  describe('When given valid login info and correct project', () => {
    const response = makeLoginResponse(true, 'TestProject');
    let result;

    beforeAll(async () => {
      backendSrv.datasourceRequest = jest.fn().mockReturnValue(response);
      result = await ds.testDatasource();
    });

    it('should send a correct request', async () => {
      expect(backendSrv.datasourceRequest).toBeCalledTimes(1);
      expect((backendSrv.datasourceRequest as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should log the user in', async () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('When given valid login info but incorrect project', () => {
    const response = makeLoginResponse(true, 'WrongProject');

    it('should display an error message', async () => {
      backendSrv.datasourceRequest = jest.fn().mockReturnValue(response);
      expect(await ds.testDatasource()).toMatchSnapshot();
    });
  });

  describe('When given invalid login info', () => {
    const response = makeLoginResponse(false, 'string');

    it('should display an error message', async () => {
      backendSrv.datasourceRequest = jest.fn().mockReturnValue(response);
      expect(await ds.testDatasource()).toMatchSnapshot();
    });
  });
});
