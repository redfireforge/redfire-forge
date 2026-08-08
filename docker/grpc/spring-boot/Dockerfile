FROM maven:3.9.8-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY pom.xml ./
COPY src ./src

# BuildKit TARGETARCH is amd64|arm64. Map to protoc/grpc plugin classifiers so we
# never download a host-OS (e.g. osx-aarch_64) binary inside the Linux image.
ARG TARGETARCH=arm64
RUN CLASSIFIER="$(case "${TARGETARCH}" in \
      amd64) echo linux-x86_64 ;; \
      arm64) echo linux-aarch_64 ;; \
      *) echo linux-x86_64 ;; \
    esac)" \
  && mvn -q -DskipTests package -Dos.detected.classifier="${CLASSIFIER}"

FROM eclipse-temurin:17-jre

WORKDIR /app
COPY --from=build /workspace/target/grpc-spring-boot-fixture-0.0.1-SNAPSHOT.jar /app/app.jar

EXPOSE 8081 9090

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
