## Getting Started

Update the project settings
1. Edit the name in package.json. Note : it must be start with 'vep-' for sonarqube to recognize
2. Edit the appName / appDomain and appService in src/config/default.ts

## Programming Lanuage
- [Typescript](https://www.typescriptlang.org/)

## Framework
- [Nest.js](https://nestjs.com/)


----
## GitLab Repository
Our project will be hosted in `GitLab` using CI/CD.

### Branch Definion
| Branch | Purpose  |
| :---   | :--- |
| develop | When a feature is completed, it gets merged into develop branch |
| sit | Once develop branch has acquired enough features for sit, we merge the develop into sit branch for system integration test |
| uat | Once the system is ready for end user to perform UAT test, we merge the sit branch to uat branch |
| preprd | Once it is ready for pre-production, the uat branch gets merged into preprd branch |
| master |Once it is ready for production, the preprd branch gets merged into master and tagged with a version number |
| feature/* | Commit your change on those branch named started with feature/* |

<br>

### Feature branch
Before develop project, please create a new branch by naming __`feature/{Jira issue key}-{summary without "VEP Website -" (underline instead spacing)}`__
> `SHOULD NOT COMMIT` your changes into dev branch directly

For example:
```sh
# Good
feature/VT-344-Frontend_foundation
feature/VT-257-Homepage_(Live_Event_Sectiona)

# Allow
feature/VT-344-frontend_foundation
feature/VT-257-homepage_(live_event_sectiona)

# Not accept
component/slider
articlecard
```



## Installation
```shell
yarn global add @nestjs/cli
yarn install
```

## Test
```shell
# unit tests
yarn run test
```

## Running the app

```shell
# development
NODE_ENV=develop yarn run start

# watch mode
yarn run start:dev

# production mode
yarn run start:prod
```

## CI / CD
In `.gitlab-ci.yml`, use the `only:refs` keyword to control when to add the jobs to a pipeline based on branch neames

Example of `only:refs`
```
job2:
  script: echo
  only:
    refs:
      - branches
```

## Pass environment variable from command line to yarn
NODE_ENV=uat yarn start
## Setup Parameters Store

Service | Envirnoment | Name | Parameter Name
---------|----------|---------|---------
 BMAI | clouddev | BMAI Service API Key | /VepDeploymentParameter/dev/Ecs/C2M/BMAI_SERVICE_X_API_KEY |
 BMAI | sit | BMAI Service API Key | /VepDeploymentParameter/sit/Ecs/C2M/BMAI_SERVICE_X_API_KEY |
 BMAI | uat | BMAI Service API Key | /VepDeploymentParameter/uat/Ecs/C2M/BMAI_SERVICE_X_API_KEY |
 BMAI | preprd | BMAI Service API Key | /VepDeploymentParameter/preprd/Ecs/C2M/BMAI_SERVICE_X_API_KEY |
 BMAI | prd | BMAI Service API Key | /VepDeploymentParameter/prd/Ecs/C2M/BMAI_SERVICE_X_API_KEY |
 BMAI | dr | BMAI Service API Key | /VepDeploymentParameter/dr/Ecs/C2M/BMAI_SERVICE_X_API_KEY |