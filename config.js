var config = {};

config.ip = process.env.PIONEER_IP || '192.168.1.88';
config.port = process.env.PIONEER_PORT || 60128;
config.server_name = process.env.DNLA_SERVER_NAME || 'Server';

module.exports = config;