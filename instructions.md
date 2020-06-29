# Step-by-step guide to how to get started with Grafana

1. Use the virtual machine Docker to access the Grafana data source for Cognite Data Fusion. Download it here: https://www.docker.com/get-started

![Docker download](./images/image1.png)

Create an account and log in to download. Use whatever email that you prefer.

![Docker log in](./images/image2.png)

After download, log in to launch Docker.

![Docker starting](./images/image3.png)

![Docker running](./images/image4.png)

2. Use terminal to first create a Docker volume (as in the GitHub instructions). Use the command:

   docker volume create grafana-storage

3. Run Docker using the volume just created

   docker run -d --name grafana -p 3000:3000 -v grafana-storage:/var/lib/grafana cognite/grafana-cdf

The download from cognite/grafana-cdf will start immediately.

![Download Cognite plug-in](./images/image5.png)

4. Now you can access Grafana at http://localhost:3000

Standard username/password for logging in is admin/admin.

Once logged in you can see that CDF is installed.

![Opening Grafana](./images/image6.png)

5. To set up CDF, do the following:

Go to "Configuration" click Data Sources, then Add data source, and choose Cognite Data Fusion as "Type". Give the data source a name, provide the name of the project and your API key.

![Configuration](./images/image9.png)

![Add Cognite](./images/image10.png)

![Add project](./images/image11.png)

![Valid](./images/image12.png)

You're ready to make your first chart!

6. To make a chart, click on Dashboard, and choose Graph under "Add". Click on "Panel Title" and choose Edit.

![Add panel](./images/image7.png)

![Edit graph](./images/image8.png)

Under "Metric", choose your data source and aggregation, and start typing the name of your tag. Suggestions will appear.

![Add data dource](./images/image13.png)

![Add tag](./images/image14.png)

**Voilà!**

![Done chart](./images/image15.png)
