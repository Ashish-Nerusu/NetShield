FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-jammy
ENV JAVA_OPTS=""
WORKDIR /app
COPY --from=build /app/target/demo-0.0.1-SNAPSHOT.jar /app/app.jar
VOLUME ["/data"]
ENV SPRING_DATASOURCE_URL=jdbc:sqlite:/data/netshield.db
ENV APP_CORS_ALLOWED_ORIGINS=http://localhost:8080
EXPOSE 9091
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -Dserver.port=${PORT:-9091} -jar /app/app.jar"]
