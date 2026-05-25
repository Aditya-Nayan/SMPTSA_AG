# ─── Stage 1: Build with Maven ───
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy POM first (cache dependencies)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests -B

# ─── Stage 2: Run with JRE ───
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy the built JAR
COPY --from=builder /app/target/*.jar app.jar

# Railway provides PORT env var
ENV PORT=8081
EXPOSE ${PORT}

# Use PORT from Railway
ENTRYPOINT ["java", "-jar", "-Dserver.port=${PORT}", "app.jar"]
