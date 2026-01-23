pipeline {
    environment {
         NOTIFY_MAILS='1'
         RELEASE_NAME= "release_${env.RELEASE_DATE}"
         FORTY_PLAYBOOK_NAME='agpay-front-recette-fortify'
         ANSIBLE_REPO_URL='${ANSIBLE_REPOS_URL}/devsecops/agpay-v2.git'
         NEXUS_REPO_URL='${NEXUS_URL}/repository/agpay_backend_recette'
         FORTY_DEST_DIR='agpay_backend_recette'
         FORTY_CREDENTIALS=credentials('FORTIFY-ANSIBLE-CREDENTIALS')
         DEPLOY_CREDENTIALS=credentials('AGPAY-SSH')
		 RELEASE_DATE=new Date().format("yyyy-MM-dd_hh-mm-ss")
         LOADRUNNER_PROJECT_SCENARIO='"D:\\Solutions\\CRM_2016\\Scenario2.lrs"'
    }
    parameters {
      text defaultValue: '''[deploy]
    10.10.140.115 ansible_user=$DEPLOY_CREDENTIALS_USR ansible_password=$DEPLOY_CREDENTIALS_PSW host_key_checking=false ansible_ssh_common_args=\'-o StrictHostKeyChecking=no\'
    [fortify]
    $FORTIFY_HOST_NAME ansible_user=$FORTY_CREDENTIALS_USR ansible_password=$FORTY_CREDENTIALS_PSW ansible_connection=winrm ansible_port=5985 ansible_winrm_transport=kerberos''
    [loadrunner]
    $LOADRUNNER_HOST_NAME ansible_user=$FORTY_CREDENTIALS_USR ansible_password=$FORTY_CREDENTIALS_PSW ansible_connection=winrm ansible_port=5985 ansible_winrm_transport=kerberos''', name: 'INVENTORY'
    }

    agent
    {
       label "AgentLinux1"
    }
    stages
    {
       stage('Préparation')
       {
            steps
            {
                script
                {
                    if(NOTIFY_MAILS == '1') {
                        emailext (
                            body: '${JELLY_SCRIPT,template="text"}',
                            from: 'picpp@gs2e.ci', to: '$DEFAULT_RECIPIENTS',
                            subject: "${env.JOB_NAME} - Build ${env.BUILD_NUMBER} STARTED",
                            attachLog: true
                        )
                    }
                }
            }
        }
        stage('Sonarqube')
        {
            environment
            {
                    scannerHome = tool 'SonarCube_Scan'
            }
            steps
            {
                script
                {                              
                    withSonarQubeEnv(installationName: 'sonar-server',credentialsId: 'SonarqubeToken')
                    {
                        sh "${scannerHome}/bin/sonar-scanner \
                            -Dsonar.projectKey=agpay_backend_recette \
                            -Dsonar.projectName=agpay_backend_recette \
                            -Dsonar.projectVersion=1.0 \
                            -Dsonar.sources=."                                      
                    }
                }                            
                echo 'Code analysis scan terminé.'
            }
        }
        stage('Build')
        {
            steps
            {
                sh "rm -rf release_*.zip"
                sh "zip -r -qq ${RELEASE_NAME}.zip ."
                echo 'Build terminé.'
                git credentialsId: 'devsecops_gitlab_root',
                url: "${env.ANSIBLE_REPO_URL}", branch: 'main'
            }
        }
        stage('Nexus')
        {
            steps
            {
                script
                {
                    withCredentials([usernameColonPassword(credentialsId: 'NEXUS_CREDENTIALS', variable: 'NEXUS_ID')])
                    {
                        sh "curl -v -u $NEXUS_ID --upload-file ${env.RELEASE_NAME}.zip ${env.NEXUS_REPO_URL}/${env.RELEASE_NAME}.zip"
                    }
                    echo 'Nexus upload terminer avec succès'                    
               }                
            }            
        }
       // stage('Fortify')
       // {
           // steps
          //  {
              //  ansiblePlaybook(
                 //   playbook: "${env.FORTY_PLAYBOOK_NAME}.yml",
                 //   inventoryContent: INVENTORY,
                   // extraVars:[
                      //  release_name : "${env.RELEASE_NAME}",
                     //   forty_build_id : "${env.BUILD_ID}",
                      //  forty_dest_dir : "${env.FORTY_DEST_DIR}"
                   // ]
               // )
            //}
        //}
        stage('Deploy')
        {
            when
            {
                branch 'refactor/dfc-dateflux'
            }
            steps
            {
                 ansiblePlaybook (
                        playbook: "agpay_backend_recette-deploy.yml",
                        inventoryContent: INVENTORY,
                        extraVars:[
                            release_name : "${env.RELEASE_NAME}",
                            deploy_dir_name : "AGPAIE"
                        ],
                        extras : "-b"
                    )
            }
        }
        stage('Loadrunner')
        {
            steps
            {
               /* ansiblePlaybook(
                    playbook: "${env.LOADRUNNER_PLAYBOOK_NAME}.yml",
                    inventoryContent: INVENTORY,
                    extraVars:[
                        release_name : "${env.RELEASE_NAME}",
                        loadrunner_project_path : "${env.LOADRUNNER_PROJECT_PATH}",
                        loadrunner_project_name : "${env.LOADRUNNER_PROJECT_NAME}",
                        loadrunner_root_path : "${env.LOADRUNNER_ROOT_PATH}",
                        loadrunner_notif_to: '$EMAILS_DEST_TEAM_LOADRUNNER',
						loadrunner_notif_cc:'$EMAILS_CC_TEAM_LOADRUNNER',
						loadrunner_notif_subject: "${env.JOB_NAME},Build ${env.BUILD_NUMBER}",
                        loadrunner_report_name:"${env.LOADRUNNER_REPORT_NAME}"
                    ]
                )*/
                script
                {
                    sh "curl http://gsemicrofb4p:82/?lr_file=${env.LOADRUNNER_PROJECT_SCENARIO}"
 
                }
            }   
        }
        //stage('Loadrunner')
       // {
         //   steps
          //  {
          //      ansiblePlaybook(
              //      playbook: "${env.LOADRUNNER_PLAYBOOK_NAME}.yml",
                //    inventoryContent: INVENTORY,
                 //   extraVars:[
                   //     release_name : "${env.RELEASE_NAME}",
                    //    loadrunner_project_path : "${env.LOADRUNNER_PROJECT_PATH}",
                     //   loadrunner_project_name : "${env.LOADRUNNER_PROJECT_NAME}",
                     //   loadrunner_root_path : "${env.LOADRUNNER_ROOT_PATH}"
                  //  ]
              //  )
           // }
        //}
    }
    post
    {
        always
        {
            script
            {
                sh "rm -rf ${env.RELEASE_NAME}.zip"
                if(NOTIFY_MAILS == '1')
                {
                    emailext (
                        body: '${JELLY_SCRIPT,template="text"}',
                        subject: "${env.JOB_NAME} - Build ${env.BUILD_NUMBER} ${currentBuild.currentResult}",
                        from: 'picpp@gs2e.ci', to: '$DEFAULT_RECIPIENTS',
                        attachLog: true
                    )
                }
            }
        }
    }
}