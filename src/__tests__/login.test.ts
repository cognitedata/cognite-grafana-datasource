import { getMockedDataSource } from './utils';

jest.mock('@grafana/runtime');
type Mock = jest.Mock;
const ds = getMockedDataSource();
const { backendSrv } = ds;

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
      backendSrv.datasourceRequest = jest.fn().mockReturnValue(response);
      const result = await ds.testDatasource();

      expect(backendSrv.datasourceRequest).toBeCalledTimes(1);
      expect((backendSrv.datasourceRequest as Mock).mock.calls[0][0]).toMatchSnapshot();
      expect(result).toMatchSnapshot();
    });
  });

  describe('When given valid login info but incorrect project', () => {
    const response = makeLoginResponse(true, 'WrongProject');

    it('should display an error message', async () => {
      backendSrv.datasourceRequest = jest.fn().mockReturnValue(response);
      const result = await ds.testDatasource();

      expect(backendSrv.datasourceRequest).toBeCalledTimes(1);
      expect((backendSrv.datasourceRequest as Mock).mock.calls[0][0]).toMatchSnapshot();
      expect(result).toMatchSnapshot();
    });
  });

  describe('When given invalid login info', () => {
    const response = makeLoginResponse(false, 'string');

    it('should display an error message', async () => {
      backendSrv.datasourceRequest = jest.fn().mockReturnValue(response);
      const result = await ds.testDatasource();

      expect(backendSrv.datasourceRequest).toBeCalledTimes(1);
      expect((backendSrv.datasourceRequest as Mock).mock.calls[0][0]).toMatchSnapshot();
      expect(result).toMatchSnapshot();
    });
  });
});
