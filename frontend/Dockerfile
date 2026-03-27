# Use NGINX as base image
FROM nginx:alpine

# Copy the built frontend files into the NGINX html directory
COPY dist/ /usr/share/nginx/html

# Copy your custom NGINX config (optional but recommended for routing, CORS, etc.)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80
