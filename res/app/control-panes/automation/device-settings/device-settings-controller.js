module.exports = function DeviceSettingsCtrl($scope, $http, $timeout) {
  $scope.wifiEnabled = true

  function getWifiStatus() {
    if ($scope.control) {
      $scope.control.getWifiStatus().then(function(result) {
        $scope.$apply(function() {
          $scope.wifiEnabled = (result.lastData === 'wifi_enabled')
        })
      })
    }
  }
  getWifiStatus()

  $scope.toggleWifi = function(enable) {
    if ($scope.control) {
      $scope.control.setWifiEnabled(enable)
      $timeout(getWifiStatus, 2500)
    }
  }

  $scope.killAutomation = function() {
    var data = {
      username: $scope.botAutomation.username.$modelValue
    }

    $scope.invalid = false
    $http.post('/auth/api/v1/bot/stop', data)
      .success(function(response) {
        $scope.error = null
      })
      .error(function(response) {
        switch (response.error) {
          case 'ValidationError':
            $scope.error = {
              $invalid: true
            }
            break
          case 'InvalidCredentialsError':
            $scope.error = {
              $incorrect: true
            }
            break
          default:
            $scope.error = {
              $server: true
            }
            break
        }
      })
  }

  $scope.automation = function() {
    var data = {
      username: $scope.botAutomation.username.$modelValue
    }

    $scope.invalid = false
    $http.post('/auth/api/v1/bot', data)
      .success(function(response) {
        $scope.error = null
      })
      .error(function(response) {
        switch (response.error) {
          case 'ValidationError':
            $scope.error = {
              $invalid: true
            }
            break
          case 'InvalidCredentialsError':
            $scope.error = {
              $incorrect: true
            }
            break
          default:
            $scope.error = {
              $server: true
            }
            break
        }
      })
  }

  $scope.$watch('ringerMode', function(newValue, oldValue) {
    if (oldValue) {
      if ($scope.control) {
        $scope.control.setRingerMode(newValue)
      }
    }
  })

  function getRingerMode() {
    if ($scope.control) {
      $scope.control.getRingerMode().then(function(result) {
        $scope.$apply(function() {
          $scope.ringerMode = result.body
        })
      })
    }
  }
  getRingerMode()

}
