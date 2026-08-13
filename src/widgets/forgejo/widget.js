import { asJson } from "utils/proxy/api-helpers";
import genericProxyHandler from "utils/proxy/handlers/generic";

const widget = {
  api: "{url}/api/v1/{endpoint}?access_token={key}",
  proxyHandler: genericProxyHandler,

  mappings: {
    pulls: {
      endpoint: "repos/{repository}/pulls?state=open&limit=50",
    },
    commits: {
      endpoint: "repos/{repository}/commits?limit=3&stat=false&verification=false&files=false",
    },
    runs: {
      endpoint: "repos/{repository}/actions/tasks",
      map: (data) => ({
        runs: (asJson(data).workflow_runs ?? []).slice(0, 3),
      }),
    },
  },
};

export default widget;
