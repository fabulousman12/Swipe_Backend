# Use the official Node.js image as the base image
FROM node:lts

# Set the working directory inside the container
WORKDIR /usr/src/chatapp  # This is where your application code will reside in the container

# Copy the package.json and package-lock.json files to the working directory
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files into the container
COPY . .

# Expose the port the app will run on (assuming your server listens on port 3000)
EXPOSE 8000
EXPOSE 8001

# Command to run the application
CMD ["npm", "start"]  # Change to ["npm", "start"] if using npm start script
