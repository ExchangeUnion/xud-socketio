#!/bin/bash

grpc_tools_node_protoc \
--js_out=import_style=commonjs,binary:src/proto \
--ts_out=src/proto \
--grpc_out=src/proto \
--plugin=protoc-gen-ts=node_modules/.bin/protoc-gen-ts \
-I=proto \
proto/*.proto \
proto/google/api/*.proto \
proto/google/protobuf/*.proto
