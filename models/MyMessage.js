const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize'); // Import the Sequelize instance

const Message = sequelize.define('Message', {
  sender: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', // Assuming 'Users' is your user table
      key: 'id'
    }
  },
  recipient: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.STRING,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered'),
    defaultValue: 'pending'
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: false,
  tableName: 'messages'
});

module.exports = Message;
