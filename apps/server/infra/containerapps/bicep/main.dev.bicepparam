using './main.bicep'

param managedEnvironmentName = 'aca-env-dev'
param containerAppName = 'tile-fighter-server-dev'
param imageName = 'ghcr.io/example/tile-fighter-server:dev'
param containerPort = 3000
param revisionMode = 'Multiple'
param tenantMode = 'single'
