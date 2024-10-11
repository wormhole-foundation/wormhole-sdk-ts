load('ext://namespace', 'namespace_create')
load('ext://git_resource', 'git_checkout')

git_checkout('git@github.com:wormhole-foundation/wormhole.git#main', "__tests__/staging/wormhole")
load("__tests__/staging/wormhole/Tiltfile", "namespace", "k8s_yaml_with_ns", "set_env_in_jobs", "num_guardians")
config.clear_enabled_resources()
config.set_enabled_resources([
    "guardian", # Also adds in all the chains we need 
    "wormhole-sdk-ts-ci-tests"
])

# Without this, some resources cant find the namespace?
namespace_create(namespace, allow_duplicates=True)

docker_build(
    ref = "wormhole-sdk-ts-test",
    context = ".",
    dockerfile = "__tests__/Dockerfile",
    only = [],
)

k8s_yaml_with_ns(encode_yaml_stream(set_env_in_jobs(read_yaml_stream("__tests__/tests.yaml"), "NUM_GUARDIANS", str(num_guardians))))

k8s_resource(
    "wormhole-sdk-ts-ci-tests",
    labels = ["wormhole-sdk-ts-ci"],
    trigger_mode = TRIGGER_MODE_AUTO,
    resource_deps = [], # wait-run.sh, specified in the tests.yaml file, handles waiting. Not having deps gets the build earlier.
)